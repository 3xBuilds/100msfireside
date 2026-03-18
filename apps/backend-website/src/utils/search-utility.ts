import connectDB from '../config/database';
import User from '../models/User';
import Room from '../models/Room';

export const validateSearchQuery = (q: any): string | null => {
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return 'Search query is required';
  }
  return null;
};

export const parsePagination = (limit: any, offset: any) => {
  return {
    limitNum: Math.min(parseInt(limit as string) || 20, 100),
    offsetNum: parseInt(offset as string) || 0
  };
};

export const buildTextSearchQuery = (searchTerm: string, fields: string[]) => {
  return {
    $or: fields.map(field => {
      if (field === 'topics') {
        return { topics: { $in: [new RegExp(searchTerm, 'i')] } };
      }
      return { [field]: { $regex: searchTerm, $options: 'i' } };
    })
  };
};

export const ensureDBConnection = async () => {
  await connectDB();
};


// Global

export const formatGlobalResults = (users: any[], rooms: any[]) => {
  return {
    users: users.map(user => ({
      type: 'user',
      fid: user.fid,
      username: user.username,
      displayName: user.displayName,
      pfp_url: user.pfp_url,
      bio: user.bio,
      topics: user.topics
    })),
    rooms: rooms.map(room => ({
      type: 'room',
      roomId: room.roomId,
      name: room.name,
      description: room.description,
      topics: room.topics,
      host: room.host,
      status: room.status,
      startTime: room.startTime,
      endTime: room.endTime,
      enabled: room.enabled
    }))
  };
};


// Rooms

export const buildRoomSearchQuery = async (searchTerm: string, filters: any) => {
  const searchQuery: any = buildTextSearchQuery(searchTerm, ['name', 'description', 'topics']);
  
  if (filters.status) {
    const statusList = typeof filters.status === 'string' ? filters.status.split(',') : [filters.status];
    searchQuery.status = { $in: statusList };
  }
  
  if (filters.enabled !== undefined) {
    searchQuery.enabled = filters.enabled === 'true';
  }
  
  // sponsorship removed
  
  if (filters.hostFid) {
    const hostUser = await User.findOne({ fid: filters.hostFid }).select('_id');
    if (hostUser) {
      searchQuery.host = hostUser._id;
    } else {
      return null; // Host not found
    }
  }
  
  if (filters.startTimeFrom) {
    searchQuery.startTime = { ...searchQuery.startTime, $gte: new Date(filters.startTimeFrom) };
  }
  
  if (filters.startTimeTo) {
    searchQuery.startTime = { ...searchQuery.startTime, $lte: new Date(filters.startTimeTo) };
  }
  
  // Handle participant count filtering using aggregation pipeline
  if (filters.minParticipants || filters.maxParticipants) {
    const participantFilter: any = {};
    if (filters.minParticipants) {
      participantFilter.$gte = parseInt(filters.minParticipants);
    }
    if (filters.maxParticipants) {
      participantFilter.$lte = parseInt(filters.maxParticipants);
    }
    
    // Return aggregation pipeline instead of simple query
    return {
      isAggregation: true,
      pipeline: [
        { $match: searchQuery },
        {
          $lookup: {
            from: 'roomparticipants',
            localField: '_id',
            foreignField: 'roomId',
            as: 'participants'
          }
        },
        {
          $addFields: {
            participantCount: { $size: '$participants' }
          }
        },
        {
          $match: {
            participantCount: participantFilter
          }
        }
      ]
    };
  }
  
  return searchQuery;
};

export const applyRoomSorting = async (roomQuery: any, sort: string) => {
  if (sort === 'recent') {
    return roomQuery.sort({ createdAt: -1 });
  } else if (sort === 'popular') {
    // Sort by participant count using aggregation with RoomParticipant collection
    if (roomQuery.isAggregation) {
      // If it's already an aggregation pipeline, add sorting stage
      roomQuery.pipeline.push({ $sort: { participantCount: -1, createdAt: -1 } });
      return roomQuery;
    } else {
      // Convert to aggregation pipeline for popular sorting
      const baseMatch = roomQuery.getQuery ? roomQuery.getQuery() : {};
      return {
        isAggregation: true,
        pipeline: [
          { $match: baseMatch },
          {
            $lookup: {
              from: 'roomparticipants',
              localField: '_id',
              foreignField: 'roomId',
              as: 'participants'
            }
          },
          {
            $addFields: {
              participantCount: { $size: '$participants' }
            }
          },
          { $sort: { participantCount: -1, createdAt: -1 } }
        ]
      };
    }
  } else if (sort === 'upcoming') {
    return roomQuery.sort({ startTime: 1 });
  } else {
    return roomQuery.sort({ name: 1, startTime: -1 });
  }
};

export const formatRoomResults = (rooms: any[]) => {
  return rooms.map(room => ({
    roomId: room.roomId,
    name: room.name,
    description: room.description,
    topics: room.topics,
    host: room.host,
    status: room.status,
    startTime: room.startTime,
    endTime: room.endTime,
    enabled: room.enabled,
    participantCount: room.participantCount || 0 // Now available from aggregation
  }));
};

// Users

export const buildUserSearchQuery = (searchTerm: string, filters: any) => {
  const searchQuery: any = buildTextSearchQuery(searchTerm, ['username', 'displayName', 'bio', 'topics']);
  
  if (filters.isVerified !== undefined) {
    searchQuery.isVerified = filters.isVerified === 'true';
  }
  
  if (filters.fids) {
    const fidList = (filters.fids as string).split(',').map(fid => fid.trim());
    searchQuery.fid = { $in: fidList };
  }
  
  return searchQuery;
};

export const applyUserSorting = async (userQuery: any, sort: string) => {
  if (sort === 'recent') {
    return userQuery.sort({ createdAt: -1 });
  } else if (sort === 'popular') {
    // Sort by hosted room count using aggregation
    const users = await userQuery.lean();
    const userIds = users.map((user: any) => user._id);
    
    // Get hosted room counts for each user
    const hostedRoomCounts = await Room.aggregate([
      { $match: { host: { $in: userIds } } },
      { $group: { _id: '$host', hostedCount: { $sum: 1 } } }
    ]);
    
    // Create a map for quick lookup
    const countMap = new Map();
    hostedRoomCounts.forEach((item: any) => {
      countMap.set(item._id.toString(), item.hostedCount);
    });
    
    // Sort users by hosted room count (descending), then by username
    return users.sort((a: any, b: any) => {
      const aCount = countMap.get(a._id.toString()) || 0;
      const bCount = countMap.get(b._id.toString()) || 0;
      
      if (aCount !== bCount) {
        return bCount - aCount; // Descending order
      }
      
      // If counts are equal, sort alphabetically by username
      return (a.username || '').localeCompare(b.username || '');
    });
  } else {
    return userQuery.sort({ username: 1, displayName: 1 });
  }
};

export const formatUserResults = (users: any[]) => {
  return users.map(user => ({
    fid: user.fid,
    username: user.username,
    displayName: user.displayName,
    pfp_url: user.pfp_url,
    bio: user.bio,
    topics: user.topics,
    isVerified: user.isVerified
  }));
};