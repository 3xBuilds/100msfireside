import mongoose from 'mongoose';
import config from './index';

const connectDB = async () => {
  try {
    // Ensure we always connect to fireside-prod database
    const uri = new URL(config.mongodbUri);
    
    const conn = await mongoose.connect(uri.toString(), {
      dbName: 'fireside-prod',
    });
    console.log(`Connected to database: ${conn.connection.name}`);
  } catch (error) {
    console.error('Database connection error:', error);
    throw error; // Re-throw to allow proper error handling by caller
  }
};

export default connectDB;
