import mongoose, { Schema, Document, Mongoose } from 'mongoose';
import User from './User';

export interface IRoom extends Document {
  name: string;
  enabled: boolean;
  description: string;
  host: string; // userId
  participants: string[]; // userIds
  startTime: Date;
  endTime: Date | null;
  ended_at?: Date; // When the room was ended by host
  status: 'upcoming' | 'ongoing' | 'ended';
  roomId: string;
  sponsorshipEnabled: boolean;
  adsEnabled?: boolean;
  // baseSponsorshipPrice: number;
  topics: string[];
}

const Room: Schema = new Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  description: { type: String, required: false },
  host: { type: mongoose.Schema.Types.ObjectId, required: true, ref: User },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: User }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null },
  ended_at: { type: Date, default: null }, // When the room was ended by host
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'ended'], 
    default: 'upcoming' 
  },
  roomId: { type: String, required: true, unique: true },
  sponsorshipEnabled: { type: Boolean, default: false },
  adsEnabled: { type: Boolean, default: false },
  // baseSponsorshipPrice: { type: Number, default: 0 }
  topics: { type: [String], required: true },
}, {
  timestamps: true
});

export default mongoose.models.Room || mongoose.model('Room', Room);