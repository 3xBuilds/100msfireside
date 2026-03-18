
// Bankr transaction for chat messages
type BankrChatTransaction = {
    type: string; // 'transfer_erc20', 'transfer_eth', 'swap', etc.
    chainId: number;
    to: string;
    data?: string;
    value?: string;
    gas?: string;
    description?: string;
    status?: 'pending' | 'executed' | 'confirmed' | 'failed';
    txHash?: string;
}

type RedisChatMessage = {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    message: string;
    timestamp: string;
    replyTo?: {
        messageId: string;
        message: string;
        username: string;
        pfp_url: string;
    };
    isBot?: boolean;
    status?: 'pending' | 'completed' | 'failed';
    threadId?: string; // Bankr AI conversation thread ID
    transactions?: BankrChatTransaction[]; // Bankr transactions to execute
    prompterFid?: string; // FID of user who triggered the transaction
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