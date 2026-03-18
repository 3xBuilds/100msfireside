import type { ParticipantRole, RoomStatus } from '../schemas';

export const VALID_ROLES: ParticipantRole[] = ['host', 'co-host', 'speaker', 'listener'];

export const VALID_ROOM_STATUSES: RoomStatus[] = ['upcoming', 'ongoing', 'ended'];

export const isValidRoomStatus = (status: string): status is RoomStatus => {
  return VALID_ROOM_STATUSES.includes(status as RoomStatus);
};

export const isValidRole = (role: string): role is ParticipantRole => {
  return VALID_ROLES.includes(role as ParticipantRole);
};
