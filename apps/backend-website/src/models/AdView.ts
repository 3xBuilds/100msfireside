import mongoose, { Schema, Document } from 'mongoose';

export interface IAdView extends Document {
  reservationId: string;
  adId: string;
  roomId: string;
  sessionId: string;
  userFid: string;
  watchedMs: number;
  startedAt: Date;
  completedAt: Date;
}

const AdViewSchema: Schema = new Schema({
  reservationId: { type: String, required: true, index: true },
  adId: { type: String, required: true, index: true },
  roomId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true },
  userFid: { type: String, required: true, index: true },
  watchedMs: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, required: true }
}, { timestamps: true });

AdViewSchema.index({ reservationId: 1, userFid: 1 }, { unique: true });

export default mongoose.models.AdView || mongoose.model<IAdView>('AdView', AdViewSchema);


