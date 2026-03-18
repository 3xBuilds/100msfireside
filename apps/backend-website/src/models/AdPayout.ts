import mongoose, { Schema, Document } from 'mongoose';
import { AdDistributionDetail, AdPayoutData } from '../types/ads';

export type AdPayoutStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface IAdPayout extends Document {
  _id: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  roomId: string;
  status: AdPayoutStatus;
  payload?: AdPayoutData;
  swapTxHash?: string;
  transferTxHashes: string[];
  approveTxHash?: string;
  usdAmountSwapped?: number;
  fireAmountToDistribute?: number;
  fireBalanceRaw?: string;
  uniqueAds?: number;
  uniqueUsers?: number;
  totalRecipients?: number;
  totalBatches?: number;
  distributionDetails: AdDistributionDetail[];
  triggeredByFid?: string;
  triggeredByUser?: mongoose.Types.ObjectId;
  errorMessage?: string;
  errorStack?: string;
}

const DistributionDetailSchema = new Schema<AdDistributionDetail>({
  fid: { type: String, required: true, index: true },
  address: { type: String, required: true },
  amount: { type: Number, required: true },
  watchWeight: { type: Number }
}, { _id: false });

const AdPayoutSchema = new Schema<IAdPayout>({
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, unique: true },
  roomId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'skipped'], default: 'pending', index: true },
  payload: { type: Schema.Types.Mixed },
  swapTxHash: { type: String },
  transferTxHashes: { type: [String], default: [] },
  approveTxHash: { type: String },
  usdAmountSwapped: { type: Number },
  fireAmountToDistribute: { type: Number },
  fireBalanceRaw: { type: String },
  uniqueAds: { type: Number },
  uniqueUsers: { type: Number },
  totalRecipients: { type: Number },
  totalBatches: { type: Number },
  distributionDetails: { type: [DistributionDetailSchema], default: [] },
  triggeredByFid: { type: String },
  triggeredByUser: { type: Schema.Types.ObjectId, ref: 'User' },
  errorMessage: { type: String },
  errorStack: { type: String }
}, {
  timestamps: true
});

export default mongoose.models.AdPayout || mongoose.model<IAdPayout>('AdPayout', AdPayoutSchema);

