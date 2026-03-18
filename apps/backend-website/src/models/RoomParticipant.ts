import mongoose, { Schema, Document } from 'mongoose';

export interface IRoomParticipant extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'host' | 'co-host' | 'speaker' | 'listener';
  joinedAt: Date;
  leftAt?: Date;
}

const RoomParticipantSchema = new Schema({
  roomId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Room', 
    required: true,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  role: { 
    type: String, 
    enum: ['host', 'co-host', 'speaker', 'listener'], 
    required: true,
    index: true 
  },
  joinedAt: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  leftAt: { 
    type: Date 
  }
}, {
  timestamps: true
});

RoomParticipantSchema.index({ userId: 1, role: 1 });
RoomParticipantSchema.index({ roomId: 1, role: 1 });

RoomParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export default mongoose.models.RoomParticipant || mongoose.model<IRoomParticipant>('RoomParticipant', RoomParticipantSchema);
