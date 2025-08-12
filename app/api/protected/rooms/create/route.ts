import { NextRequest, NextResponse } from 'next/server';
import Room from '../../../../../utils/schemas/Room';
import { connectToDB } from '@/utils/db';

interface CreateRoomRequest {
  name: string;
  description?: string;
  template_id?: string;
  region?: string;
  max_duration_seconds?: number;
  size?: number;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDB();
    
    // Get fid from x-user-fid header (set by middleware)
    const createdBy = req.headers.get('x-user-fid');
    if (!createdBy) {
      return NextResponse.json({ error: 'Missing user FID' }, { status: 400 });
    }

    const body: CreateRoomRequest = await req.json();
    const { name, description, template_id, region = 'us', max_duration_seconds, size } = body;

    if (!name) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    // Create room using 100ms API
    const hmsResponse = await fetch('https://api.100ms.live/v2/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HMS_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${name}-${Date.now()}`, // Ensure unique names
        description,
        template_id,
        region,
        max_duration_seconds,
        size,
      }),
    });

    if (!hmsResponse.ok) {
      const error = await hmsResponse.text();
      console.error('100ms API error:', error);
      return NextResponse.json(
        { error: 'Failed to create room with 100ms' },
        { status: hmsResponse.status }
      );
    }

    const hmsRoom = await hmsResponse.json();

    // Generate room code for the created room
    const roomCodeResponse = await fetch(`https://api.100ms.live/v2/room-codes/room/${hmsRoom.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HMS_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enabled: true,
      }),
    });

    let roomCode = '';
    if (roomCodeResponse.ok) {
      const roomCodeData = await roomCodeResponse.json();
      roomCode = roomCodeData.code;
    }

    // Store room in our database
    const room = await Room.create({
      roomId: hmsRoom.id,
      name: hmsRoom.name,
      description: hmsRoom.description,
      createdBy,
      templateId: hmsRoom.template_id,
      isLive: true,
      participantCount: 0,
      maxParticipants: size,
      region: hmsRoom.region,
      roomCode,
    });

    return NextResponse.json({
      success: true,
      room: {
        id: room._id,
        roomId: room.roomId,
        name: room.name,
        description: room.description,
        roomCode: room.roomCode,
        isLive: room.isLive,
        participantCount: room.participantCount,
        createdAt: room.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
