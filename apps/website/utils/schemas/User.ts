import mongoose, { Schema, Document, Mongoose } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
  wallet:string;
  bio?: string;
  socials?: { [platform: string]: string }; // Map of platform to username
  hostedRooms: mongoose.Types.ObjectId[]; // Array of Room ObjectIds
  coHostedRooms: mongoose.Types.ObjectId[]; // Rooms participated as co-host
  speakerRooms: mongoose.Types.ObjectId[]; // Rooms participated as speaker
  listenerRooms: mongoose.Types.ObjectId[]; // Rooms participated as listener
  topics: string[];
}

const User: Schema = new Schema({
  fid: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  wallet: { type: String, required: true },
  pfp_url: { type: String, required: true },
  bio: { type: String, required: false },
  socials: { type: Map, of: String, required: false, default: {} },
  token: { type: String, required: false, default: "" },
  hostedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  coHostedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: [] }],
  speakerRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: [] }],
  listenerRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: [] }],
  topics: [{ type: String, required: false, default: [] }],
});

export default mongoose.models.User || mongoose.model('User', User);