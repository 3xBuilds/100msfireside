import mongoose, { Schema, Document } from 'mongoose';

export interface IAdAssignment extends Document {
  adId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  durationSec: number;
  status: 'reserved' | 'completed' | 'canceled';
  reservedAt: Date;
  completedAt?: Date;
  canceledAt?: Date;
  expiresAt: Date;
  webhookUrl: string;
  sessionId: string;
}

const AdAssignmentSchema: Schema = new Schema({
  adId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Advertisement' },
  roomId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Room' },
  durationSec: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['reserved', 'completed', 'canceled'], default: 'reserved' },
  reservedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  canceledAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  webhookUrl: { type: String, required: true },
  sessionId: { type: String, required: true },
}, { timestamps: true });

AdAssignmentSchema.index({ roomId: 1, status: 1 });
AdAssignmentSchema.index({ sessionId: 1 });
// Enforce at most one active reservation for same (roomId, adId) while active
AdAssignmentSchema.index(
  { roomId: 1, adId: 1 },
  { unique: true, partialFilterExpression: { status: 'reserved' } as any }
);
// Enforce at most one active reservation per (roomId, sessionId)
AdAssignmentSchema.index(
  { roomId: 1, sessionId: 1 },
  { unique: true, partialFilterExpression: { status: 'reserved' } as any }
);

export default mongoose.models.AdAssignment || mongoose.model<IAdAssignment>('AdAssignment', AdAssignmentSchema);


