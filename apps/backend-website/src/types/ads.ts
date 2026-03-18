export type AdsState = 'running' | 'stopped';

export interface AdsCurrentState {
  reservationId: string;
  adId: string;
  title: string;
  imageUrl: string;
  durationSec: number;
  startedAt: string;
  sessionId: string;
  minParticipants?: number;
  participantCountAtStart?: number;
}

export interface AdsRoomSnapshot {
  roomId: string;
  state: AdsState;
  sessionId?: string | null;
  sessionStartedAt?: string | null;
  current?: AdsCurrentState | null;
  lastEvent: string;
  reason?: string | null;
  participantCount?: number;
  minParticipants?: number;
  updatedAt: string;
}

export interface AdDistributionDetail {
  fid: string;
  address: string;
  amount: number;
  watchWeight?: number;
}

export interface AdDistributionBreakdown {
  fids: string[];
  addresses: string[];
  amounts: number[];
  details: AdDistributionDetail[];
}

export interface AdPayoutData {
  success: true;
  swapTxHash: string;
  transferTxHashes: string[];
  approveTxHash: string;
  usdAmountSwapped: number;
  fireAmountToDistribute: number;
  fireBalanceRaw: string;
  uniqueAds: number;
  uniqueUsers: number;
  totalRecipients: number;
  totalBatches: number;
  roomId: string;
  distribution: AdDistributionBreakdown;
}


