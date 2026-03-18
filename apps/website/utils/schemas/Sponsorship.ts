// import mongoose, { Schema, Document } from 'mongoose';

// export interface ISponsorship extends Document {
//   roomId: string;
//   sponsorId: string;
//   bannerUrl: string;
//   displayDuration: number;
//   price: number;
//   status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
//   requestedAt: Date;
//   approvedAt?: Date;
//   rejectedAt?: Date;
//   startTime?: Date;
//   endTime?: Date;
//   transactionHash?: string;
//   refundTransactionHash?: string;
// }

// const Sponsorship: Schema = new Schema({
//   roomId: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     required: true, 
//     ref: 'Room' 
//   },
//   sponsorId: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     required: true, 
//     ref: 'User' 
//   },
//   bannerUrl: { 
//     type: String, 
//     required: true 
//   },
//   displayDuration: { 
//     type: Number, 
//     required: true,
//     min: 1
//   },
//   price: { 
//     type: Number, 
//     required: true,
//     min: 0
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'approved', 'rejected', 'active', 'completed'],
//     default: 'pending'
//   },
//   requestedAt: {
//     type: Date,
//     default: Date.now
//   },
//   approvedAt: {
//     type: Date,
//     default: null
//   },
//   rejectedAt: {
//     type: Date,
//     default: null
//   },
//   startTime: {
//     type: Date,
//     default: null
//   },
//   endTime: {
//     type: Date,
//     default: null
//   },
//   transactionHash: {
//     type: String,
//     default: null
//   },
//   refundTransactionHash: {
//     type: String,
//     default: null
//   },
// }, {
//   timestamps: true
// });

// Sponsorship.index({ roomId: 1, status: 1 });
// Sponsorship.index({ sponsorId: 1 });

// export default mongoose.models.Sponsorship || mongoose.model('Sponsorship', Sponsorship);
