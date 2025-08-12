import { NextRequest, NextResponse } from 'next/server';
import Room from '../../../../../utils/schemas/Room';
import User from '../../../../../utils/schemas/User';
import { connectToDB } from '@/utils/db';
import type { RoomsListResponse, RoomDocument, UserDocument } from '@/types/api';

export async function GET(req: NextRequest) {
  try {
    await connectToDB();

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const createdBy = searchParams.get('createdBy');
    const skip = (page - 1) * limit;

    // Handle development mode - get FID from header or use test data
    let userFid: string | null = null;
    if (process.env.NODE_ENV === "development") {
      userFid = req.headers.get('x-user-fid') || "1175855"; // fallback to test FID
    } else {
      userFid = req.headers.get('x-user-fid');
      if (!userFid) {
        return NextResponse.json({ error: 'Missing user FID' }, { status: 400 });
      }
    }

    // Build query filter
    const queryFilter: Record<string, any> = {};
    if (createdBy) {
      queryFilter.createdBy = createdBy;
    } else {
      queryFilter.isLive = true; // Only show live rooms when not filtering by creator
    }

    // Fetch rooms sorted by creation date (latest first)
    const rooms: RoomDocument[] = await Room.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get creator information for each room
    const roomsWithCreators = await Promise.all(
      rooms.map(async (room: RoomDocument) => {
        const creator: UserDocument | null = await User.findOne({ fid: room.createdBy }).lean();
        return {
          id: room._id.toString(),
          roomId: room.roomId,
          name: room.name,
          description: room.description || '',
          roomCode: room.roomCode || '',
          isLive: room.isLive,
          participantCount: room.participantCount,
          maxParticipants: room.maxParticipants,
          createdAt: room.createdAt.toISOString(),
          updatedAt: room.updatedAt.toISOString(),
          creator: creator ? {
            fid: creator.fid,
            username: creator.username,
            displayName: creator.displayName,
            pfp_url: creator.pfp_url,
          } : null,
        };
      })
    );

    // Get total count for pagination
    const totalRooms = await Room.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalRooms / limit);

    const response: RoomsListResponse = {
      success: true,
      rooms: roomsWithCreators,
      pagination: {
        currentPage: page,
        totalPages,
        totalRooms,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
