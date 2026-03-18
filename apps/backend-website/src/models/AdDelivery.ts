import mongoose, { Schema, Document } from 'mongoose';

export interface IAdDelivery extends Document {
  adId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const AdDeliverySchema: Schema = new Schema({
  adId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Advertisement' },
  roomId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Room' },
}, { timestamps: { createdAt: true, updatedAt: false } });

AdDeliverySchema.index({ roomId: 1, adId: 1 }, { unique: true });

export default mongoose.models.AdDelivery || mongoose.model<IAdDelivery>('AdDelivery', AdDeliverySchema);



