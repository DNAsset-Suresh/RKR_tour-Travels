import mongoose from 'mongoose';

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      connectTimeoutMS: 3500,
      serverSelectionTimeoutMS: 3500,
      socketTimeoutMS: 5000,
    };
    cached.promise = mongoose.connect(uri, opts).then(m => m.connection);
  }

  let timer;
  try {
    cached.conn = await Promise.race([
      cached.promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('MongoDB connection timed out')), 3800);
      })
    ]);
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  return cached.conn;
}
