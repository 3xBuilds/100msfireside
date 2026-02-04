import mongoose, { Schema, Document } from 'mongoose';
import type { User } from '../schemas';

const User: Schema = new Schema({
  fid: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  wallet: { type: String, required: true },
  pfp_url: { type: String, required: true },
  bio: { type: String, required: false },
  topics: [{ type: String, default: [] }],
  token: { type: String, required: false },
  socials: { type: Map, of: String, required: false },
  autoAdsEnabled: { type: Boolean, default: false },
  adEarnings: {
    totalFire: { type: Number, default: 0 },
    totalUsd: { type: Number, default: 0 },
    payoutCount: { type: Number, default: 0 },
    lastPayoutAt: { type: Date },
    lastRoomId: { type: String },
    lastPayoutRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AdPayout' }
  },
  lastLoginRewardClaimDate: { type: Date },
  lastHostingRewardDate: { type: Date },
  rewards: {
    totalEarned: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    lastRewardAt: { type: Date }
  },
  hostingStats: {
    totalRoomsHosted: { type: Number, default: 0 },
    totalParticipantsEngaged: { type: Number, default: 0 },
    lastRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }
  },
  xmtpEncryptionKey: { type: String, required: false }
},{
  timestamps: true
});

export default mongoose.models.User || mongoose.model('User', User);