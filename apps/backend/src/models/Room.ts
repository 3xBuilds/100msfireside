import mongoose, { Schema } from 'mongoose';
import User from './User';
import type { Room, RoomStatus } from '../schemas';

const Room: Schema = new Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  adsEnabled: { type: Boolean, default: true },
  description: { type: String, required: false },
  host: { type: mongoose.Schema.Types.ObjectId, required: true, ref: User },
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null },
  ended_at: { type: Date, default: null }, // When the room was ended by host
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'ended'], 
    default: 'upcoming' 
  },
  roomId: { type: String, default: "" }, // HMS Room ID
  xmtpGroupId: { type: String, default: null }, // XMTP Group Conversation ID
  interested: [{ type: mongoose.Schema.Types.ObjectId, default: [] }], // Array of user FIDs who showed interest
  participants: [{ type: mongoose.Schema.Types.ObjectId, default: [] }], // Array of user FIDs who participated
  topics: [{ type: String, default: [] }],
  // Recurring room fields
  isRecurring: { type: Boolean, default: false },
  recurrenceType: { type: String, enum: ['daily', 'weekly', null], default: null },
  recurrenceDay: { type: Number, min: 0, max: 6, default: null }, // 0=Sun, 6=Sat for weekly
  parentRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  occurrenceNumber: { type: Number, default: null },
  // Recording preference
  recordingEnabled: { type: Boolean, default: true },
}, {
  timestamps: true
});

// Indexes for query performance
Room.index({ host: 1, startTime: 1 });
Room.index({ parentRoomId: 1, startTime: 1 });
Room.index({ status: 1, startTime: 1 });

export default (mongoose.models.Room as any) || mongoose.model('Room', Room as any);
