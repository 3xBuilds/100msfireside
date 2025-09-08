
type RedisChatMessage = {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    message: string;
    timestamp: string;
}

type RoomParticipant = {
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    wallet: string;
    role: 'host' | 'co-host' | 'speaker' | 'listener';
    status: 'active' | 'inactive';
    joinedAt: string;
}