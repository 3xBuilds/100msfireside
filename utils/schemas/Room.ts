import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  name: string;
  description?: string;
  createdBy: string; // FID of the creator
  templateId?: string;
  isLive: boolean;
  participantCount: number;
  maxParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
  region?: string;
  roomCode?: string;
}

const RoomSchema: Schema = new Schema({
  roomId: { type: String, required: true, unique: true }, // 100ms room ID
  name: { type: String, required: true },
  description: { type: String },
  createdBy: { type: String, required: true }, // FID of creator
  templateId: { type: String },
  isLive: { type: Boolean, default: true },
  participantCount: { type: Number, default: 0 },
  maxParticipants: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  region: { type: String },
  roomCode: { type: String },
});

// Update the updatedAt field before saving
RoomSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
