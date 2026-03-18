import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvertisement extends Document {
  title: string;
  imageUrl: string;
  minutesPerRoom: number;
  totalRooms: number;
  roomsRemaining: number;
  minParticipants: number;
  status: 'active' | 'completed';
  // txHashes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AdvertisementSchema: Schema = new Schema({
  title: { type: String, required: true },
  imageUrl: { type: String, required: true },
  minutesPerRoom: { type: Number, required: true, min: 1 },
  totalRooms: { type: Number, required: true, min: 1 },
  roomsRemaining: { type: Number, required: true, min: 0 },
  minParticipants: { type: Number, required: true, min: 1, default: 1 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  // txHashes: { type: [String], required: true },
}, { timestamps: true });

AdvertisementSchema.index({ status: 1, createdAt: 1 });

export default mongoose.models.Advertisement || mongoose.model<IAdvertisement>('Advertisement', AdvertisementSchema);


