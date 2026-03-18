import Room from "../models/Room";
import User from "../models/User";
import { RedisRoomParticipantsService } from "../services/redis/room-participants";
import { AgoraAPI } from "../services/agoraAPI";
import { adRevDistribute } from "../services/ads/adRevDistribute";
import { flushRoomReservationViews } from "../services/ads/viewTracking";

/**
 * Calculate next occurrence date for recurring rooms
 */
export const calculateNextOccurrence = (
  lastStartTime: Date,
  recurrenceType: string,
  recurrenceDay?: number
): Date => {
  const now = new Date();
  const next = new Date(lastStartTime);

  if (recurrenceType === "daily") {
    // Add one day
    next.setDate(next.getDate() + 1);
    // If calculated date is in the past, move to tomorrow from now
    if (next < now) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
      return tomorrow;
    }
  } else if (recurrenceType === "weekly" && recurrenceDay !== undefined) {
    // Find next occurrence of the specified day
    const targetDay = recurrenceDay;
    const daysToAdd = ((targetDay - next.getDay() + 7) % 7) || 7;
    next.setDate(next.getDate() + daysToAdd);
    
    // If calculated date is in the past, find next week's occurrence
    if (next < now) {
      const currentDay = now.getDay();
      let daysUntilTarget = (targetDay - currentDay + 7) % 7;
      if (daysUntilTarget === 0) daysUntilTarget = 7; // Next week if today is target day
      
      const nextOccurrence = new Date(now);
      nextOccurrence.setDate(now.getDate() + daysUntilTarget);
      nextOccurrence.setHours(next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
      return nextOccurrence;
    }
  }

  return next;
};

/**
 * Create next occurrence for recurring room
 */
export const createNextOccurrence = async (endedRoom: any): Promise<void> => {
  try {
    if (!endedRoom.isRecurring || !endedRoom.recurrenceType) {
      return;
    }

    const nextStartTime = calculateNextOccurrence(
      endedRoom.startTime,
      endedRoom.recurrenceType,
      endedRoom.recurrenceDay
    );

    const nextOccurrenceNumber = (endedRoom.occurrenceNumber || 0) + 1;
    const parentId = endedRoom.parentRoomId || endedRoom._id;

    const nextRoom = new Room({
      name: endedRoom.name,
      description: endedRoom.description,
      host: endedRoom.host,
      startTime: nextStartTime,
      roomId: "", // Will be created when room starts
      status: "upcoming",
      enabled: true,
      topics: endedRoom.topics,
      adsEnabled: endedRoom.adsEnabled,
      isRecurring: true,
      recurrenceType: endedRoom.recurrenceType,
      recurrenceDay: endedRoom.recurrenceDay,
      parentRoomId: parentId,
      occurrenceNumber: nextOccurrenceNumber,
      interested: [], // Reset interested users for new occurrence
      participants: [],
      recordingEnabled: endedRoom.recordingEnabled,
    });

    await nextRoom.save();
    console.log(
      `📅 Created next occurrence #${nextOccurrenceNumber} for recurring room: ${endedRoom.name} at ${nextStartTime.toISOString()}`
    );
  } catch (error) {
    console.error("❌ Error creating next occurrence:", error);
  }
};

/**
 * Room Cleanup Cron Service
 *
 * Handles automated cleanup of rooms that have no participants for 5+ minutes
 * Uses Agora API as the source of truth for participant information
 */
export class RoomCleanupService {
  /**
   * Delete rooms that have been empty for more than 5 minutes
   * Checks participant count from Agora API and deletes rooms with 0 participants
   * that haven't been updated in the last 5 minutes
   */
  static async cleanupEmptyRooms(): Promise<void> {
    try {
      console.log("🧹 Starting room cleanup task...");

      // Get all ongoing rooms that could potentially be empty
      const ongoingRooms = await Room.find({
        status: "ongoing",
        enabled: true,
      }).select("roomId name host updatedAt");

      if (ongoingRooms.length === 0) {
        console.log("📝 No ongoing rooms found to check");
        return;
      }

      console.log(
        `🔍 Checking ${ongoingRooms.length} ongoing rooms for empty participants...`
      );

      const roomsToDelete: string[] = [];
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const agoraAPI = new AgoraAPI();

      for (const room of ongoingRooms) {
        try {
          const peersResponse = await agoraAPI.listChannelUsers(room.roomId);
          const participantCount = peersResponse.count;

          if (participantCount === 0 && room.updatedAt < fiveMinsAgo) {
            console.log(
              `🗑️  Room "${room.name}" (${room.roomId}) has been empty for 5+ minutes - marking for deletion`
            );
            roomsToDelete.push(room.roomId);
          }
          else if (participantCount === 0) {
            console.log(
              `⏳ Room "${room.name}" (${room.roomId}) is currently empty but was updated recently - skipping for now`
            );
          }
           else {
            console.log(
              `✅ Room "${room.name}" (${room.roomId}) has ${participantCount} active participants`
            );
          }
        } catch (error) {
          console.error(`❌ Error checking room ${room.roomId}:`, error);
          continue;
        }
      }

      if (roomsToDelete.length > 0) {
        console.log(`🗑️  Deleting ${roomsToDelete.length} empty rooms...`);

        for (const roomId of roomsToDelete) {
          try {
            await agoraAPI.endChannel(
              roomId
            );
          } catch (err) {
            console.error(`❌ Error ending room ${roomId} via Agora API:`, err);
          }
          try {
            const updatedRoom = await Room.findOneAndUpdate(
              { roomId },
              {
                status: "ended",
                enabled: false,
                ended_at: new Date(),
                endTime: new Date(),
              },
              { new: true, select: "_id adsEnabled roomId" }
            );

            await RedisRoomParticipantsService.deleteRoomParticipants(roomId);

            let viewsFlushed = false;
            if (updatedRoom?._id) {
              try {
                await flushRoomReservationViews(updatedRoom._id.toString());
                viewsFlushed = true;
              } catch (viewErr) {
                console.error(
                  `⚠️ Failed to flush ad views for room ${roomId}:`,
                  viewErr
                );
              }
            }

            if (updatedRoom && updatedRoom.adsEnabled !== false) {
              if (!viewsFlushed) {
                console.warn(
                  `⚠️ Skipping ad payout for room ${roomId} because views were not flushed`
                );
              } else {
              try {
                await adRevDistribute({ roomId: updatedRoom._id.toString() });
                console.log(
                  `🎯 Ad payout triggered for cleaned up room: ${updatedRoom._id.toString()}`
                );
              } catch (payoutErr) {
                console.error(
                  `⚠️ Failed to trigger ad payout for room ${roomId}:`,
                  payoutErr
                );
              }
              }
            }

            console.log(`✅ Successfully cleaned up room: ${roomId}`);
            
            // Create next occurrence if recurring
            if (updatedRoom && updatedRoom.isRecurring) {
              await createNextOccurrence(updatedRoom);
            }
          } catch (error) {
            console.error(`❌ Error deleting room from db ${roomId}:`, error);
          }
        }

        console.log(
          `🎉 Room cleanup completed! Deleted ${roomsToDelete.length} empty rooms`
        );
      } else {
        console.log("✨ No empty rooms found to delete");
      }
    } catch (error) {
      console.error("❌ Room cleanup task failed:", error);
    }
  }
}
