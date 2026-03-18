import mongoose, { Schema } from 'mongoose';

export type RewardType = 'daily_login' | 'host_room' | 'participant_milestone';
export type RewardStatus = 'pending' | 'completed' | 'failed';

const RewardSchema: Schema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    ref: 'User',
    index: true 
  },
  type: { 
    type: String, 
    enum: ['daily_login', 'host_room', 'participant_milestone'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    enum: ['FIRE', 'USDC'], 
    default: 'FIRE' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  metadata: {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    participantCount: { type: Number },
    loginStreak: { type: Number },
    milestone: { type: Number },
    roomDuration: { type: Number }, // in minutes
  },
  txHash: { type: String },
  errorMessage: { type: String },
  claimedAt: { type: Date },
  distributedAt: { type: Date },
}, {
  timestamps: true
});

// Indexes for query performance
RewardSchema.index({ userId: 1, createdAt: -1 });
RewardSchema.index({ type: 1, status: 1 });
RewardSchema.index({ status: 1, createdAt: 1 });

export default (mongoose.models.Reward as any) || mongoose.model('Reward', RewardSchema as any);
