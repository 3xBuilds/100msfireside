// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Room Types
export interface RoomCreator {
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
}

export interface RoomData {
  id: string;
  roomId: string;
  name: string;
  description?: string;
  roomCode?: string;
  isLive: boolean;
  participantCount: number;
  maxParticipants?: number;
  createdAt: string;
  updatedAt: string;
  creator: RoomCreator | null;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRooms: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface RoomsListResponse {
  success: boolean;
  rooms: RoomData[];
  pagination: PaginationInfo;
}

// Request Types
export interface CreateRoomRequest {
  name: string;
  description?: string;
  template_id?: string;
  region?: string;
  max_duration_seconds?: number;
  size?: number;
}

export interface CreateRoomResponse {
  success: boolean;
  room: {
    id: string;
    roomId: string;
    name: string;
    description?: string;
    roomCode?: string;
    isLive: boolean;
    participantCount: number;
    createdAt: string;
  };
}

// MongoDB Document Types (for server-side)
export interface RoomDocument {
  _id: any;
  roomId: string;
  name: string;
  description?: string;
  createdBy: string;
  templateId?: string;
  isLive: boolean;
  participantCount: number;
  maxParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
  region?: string;
  roomCode?: string;
}

export interface UserDocument {
  _id: any;
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
}
