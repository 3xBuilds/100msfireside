import type { RoomParticipant, ParticipantRole, ParticipantStatus } from '../../schemas';
import { RedisUtils } from './redis-utils';

/**
 * Redis Room Participants Service
 * 
 * Comprehensive participant management with optimized Redis operations and function overloading.
 * 
 * Key Structure:
 * - room:{roomId}:participants -> Hash of userId -> participant data
 * - room:{roomId}:roles -> Hash of userId -> role
 * - room:{roomId}:status -> Hash of userId -> status
 */
export class RedisRoomParticipantsService {
    /**
     * Add or update a participant in the room
     */
    static async addParticipant(roomId: string, user: any, role: ParticipantRole): Promise<void> {
        const client = await RedisUtils.getClient();
        const participantData = {
            userId: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            wallet: user.wallet || '',
            joinedAt: new Date().toISOString()
        };

        const pipeline = client.pipeline();
        pipeline.hset(RedisUtils.roomKeys.participants(roomId), user.fid, JSON.stringify(participantData));
        pipeline.hset(RedisUtils.roomKeys.roles(roomId), user.fid, role);
        pipeline.hset(RedisUtils.roomKeys.status(roomId), user.fid, 'active');
        pipeline.expire(RedisUtils.roomKeys.participants(roomId), RedisUtils.TTL);
        pipeline.expire(RedisUtils.roomKeys.roles(roomId), RedisUtils.TTL);
        pipeline.expire(RedisUtils.roomKeys.status(roomId), RedisUtils.TTL);
        
        await RedisUtils.executePipeline(pipeline);
    }

    /**
     * Get a specific participant with their role and status
     */
    static async getParticipant(roomId: string, userFid: string): Promise<RoomParticipant | null> {
        const client = await RedisUtils.getClient();
        
        const [participantData, role, status] = await Promise.all([
            client.hget(RedisUtils.roomKeys.participants(roomId), userFid),
            client.hget(RedisUtils.roomKeys.roles(roomId), userFid),
            client.hget(RedisUtils.roomKeys.status(roomId), userFid)
        ]);

        if (!participantData || !role) return null;

        const baseData = RedisUtils.safeJsonParse(participantData);
        if (!baseData) return null;

        return {
            ...baseData,
            role: role as ParticipantRole,
            status: (status || 'active') as ParticipantStatus
        } as RoomParticipant;
    }

    /**
     * Update participant role
     */
    static async updateParticipantRole(roomId: string, userFid: string, newRole: ParticipantRole): Promise<void> {
        const client = await RedisUtils.getClient();
        await client.hset(RedisUtils.roomKeys.roles(roomId), userFid, newRole);
        await client.expire(RedisUtils.roomKeys.roles(roomId), RedisUtils.TTL);
    }

    /**
     * Update participant status
     */
    static async updateParticipantStatus(roomId: string, userFid: string, newStatus: ParticipantStatus): Promise<void> {
        const client = await RedisUtils.getClient();
        await client.hset(RedisUtils.roomKeys.status(roomId), userFid, newStatus);
        await client.expire(RedisUtils.roomKeys.status(roomId), RedisUtils.TTL);
    }

    /**
     * Remove participant from room
     */
    static async removeParticipant(roomId: string, userFid: string): Promise<void> {
        const client = await RedisUtils.getClient();
        const pipeline = client.pipeline();
        
        pipeline.hdel(RedisUtils.roomKeys.participants(roomId), userFid);
        pipeline.hdel(RedisUtils.roomKeys.roles(roomId), userFid);
        pipeline.hdel(RedisUtils.roomKeys.status(roomId), userFid);
        
        await RedisUtils.executePipeline(pipeline);
    }

    /**
     * Get participants - overloaded for flexible filtering
     */
    // Get all participants
    static async getParticipants(roomId: string): Promise<RoomParticipant[]>;
    // Get participants with active/inactive filter
    static async getParticipants(roomId: string, activeOnly: boolean): Promise<RoomParticipant[]>;
    // Get participants by specific role
    static async getParticipants(roomId: string, role: ParticipantRole): Promise<RoomParticipant[]>;
    // Get participants by role with active filter
    static async getParticipants(roomId: string, role: ParticipantRole, activeOnly: boolean): Promise<RoomParticipant[]>;
    // Get participants grouped by role
    static async getParticipants(roomId: string, groupByRole: 'grouped'): Promise<Record<ParticipantRole, RoomParticipant[]>>;
    // Get participants grouped by role with active filter
    static async getParticipants(roomId: string, groupByRole: 'grouped', activeOnly: boolean): Promise<Record<ParticipantRole, RoomParticipant[]>>;
    
    static async getParticipants(
        roomId: string,
        filterOrRole?: boolean | ParticipantRole | 'grouped',
        activeOnly: boolean = false
    ): Promise<RoomParticipant[] | Record<ParticipantRole, RoomParticipant[]>> {
        const client = await RedisUtils.getClient();
        
        const [participantsData, rolesData, statusData] = await Promise.all([
            client.hgetall(RedisUtils.roomKeys.participants(roomId)),
            client.hgetall(RedisUtils.roomKeys.roles(roomId)),
            client.hgetall(RedisUtils.roomKeys.status(roomId))
        ]);

        const participants: RoomParticipant[] = [];
        
        for (const [userId, participantJson] of Object.entries(participantsData)) {
            const role = rolesData[userId] as ParticipantRole;
            const status = (statusData[userId] || 'active') as ParticipantStatus;
            
            // Apply active filter when specified
            const isActiveFilter = typeof filterOrRole === 'boolean' ? filterOrRole : activeOnly;
            if (isActiveFilter && status !== 'active') continue;
            
            // Apply role filter when specified
            if (typeof filterOrRole === 'string' && filterOrRole !== 'grouped' && role !== filterOrRole) continue;
            
            const baseData = RedisUtils.safeJsonParse(participantJson);
            if (baseData) {
                participants.push({
                    ...baseData,
                    role,
                    status
                } as RoomParticipant);
            }
        }

        // Return grouped by role if requested
        if (filterOrRole === 'grouped') {
            const grouped: Record<ParticipantRole, RoomParticipant[]> = {
                host: [],
                'co-host': [],
                speaker: [],
                listener: []
            };
            
            participants.forEach(participant => {
                grouped[participant.role].push(participant);
            });
            
            return grouped;
        }

        return participants;
    }

    /**
     * Get participant counts - overloaded for flexible counting
     */
    // Get total participant count
    static async getParticipantCount(roomId: string): Promise<number>;
    // Get active participant count
    static async getParticipantCount(roomId: string, activeOnly: boolean): Promise<number>;
    // Get count by role
    static async getParticipantCount(roomId: string, role: ParticipantRole): Promise<number>;
    // Get count by role with active filter
    static async getParticipantCount(roomId: string, role: ParticipantRole, activeOnly: boolean): Promise<number>;
    // Get counts grouped by role
    static async getParticipantCount(roomId: string, groupByRole: 'grouped'): Promise<Record<ParticipantRole | 'total', number>>;
    // Get counts grouped by role with active filter
    static async getParticipantCount(roomId: string, groupByRole: 'grouped', activeOnly: boolean): Promise<Record<ParticipantRole | 'total', number>>;
    
    static async getParticipantCount(
        roomId: string,
        filterOrRole?: boolean | ParticipantRole | 'grouped',
        activeOnly: boolean = false
    ): Promise<number | Record<ParticipantRole | 'total', number>> {
        if (filterOrRole === 'grouped') {
            const participantsByRole = await this.getParticipants(roomId, 'grouped', activeOnly) as Record<ParticipantRole, RoomParticipant[]>;
            const counts = {
                host: participantsByRole.host.length,
                'co-host': participantsByRole['co-host'].length,
                speaker: participantsByRole.speaker.length,
                listener: participantsByRole.listener.length,
                total: 0
            };
            counts.total = counts.host + counts['co-host'] + counts.speaker + counts.listener;
            return counts;
        }
        
        let participants: RoomParticipant[];
        if (typeof filterOrRole === 'string') {
            participants = await this.getParticipants(roomId, filterOrRole as ParticipantRole, activeOnly);
        } else {
            const isActiveFilter = typeof filterOrRole === 'boolean' ? filterOrRole : false;
            participants = await this.getParticipants(roomId, isActiveFilter);
        }
        
        return participants.length;
    }

    /**
     * Check user membership and role - overloaded for different checks
     */
    // Check if user is in room (active status)
    static async isUserInRoom(roomId: string, userFid: string): Promise<boolean>;
    // Get user's role if in room
    static async isUserInRoom(roomId: string, userFid: string, returnRole: true): Promise<ParticipantRole | null>;
    
    static async isUserInRoom(
        roomId: string, 
        userFid: string, 
        returnRole?: boolean
    ): Promise<boolean | ParticipantRole | null> {
        const participant = await this.getParticipant(roomId, userFid);
        const isActive = participant !== null && participant.status === 'active';
        
        if (returnRole) {
            return isActive ? participant!.role : null;
        }
        
        return isActive;
    }

    /**
     * Clean up all room participant data
     */
    static async deleteRoomParticipants(roomId: string): Promise<void> {
        const client = await RedisUtils.getClient();
        const pipeline = client.pipeline();
        
        pipeline.del(RedisUtils.roomKeys.participants(roomId));
        pipeline.del(RedisUtils.roomKeys.roles(roomId));
        pipeline.del(RedisUtils.roomKeys.status(roomId));
        
        await RedisUtils.executePipeline(pipeline);
    }
}
