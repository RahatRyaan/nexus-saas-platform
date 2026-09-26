import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { env } from './config/env';

async function testConnections() {
  console.log('🔍 Testing MongoDB Atlas Connection...');
  try {
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB Atlas connected successfully!');
    await mongoose.disconnect();
  } catch (err: any) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }

  console.log('\n🔍 Testing Cloudinary API Credentials...');
  try {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    const res = await cloudinary.api.ping();
    console.log('✅ Cloudinary API verified successfully! Status:', res.status);
  } catch (err: any) {
    console.error('❌ Cloudinary Error:', err.message);
  }

  process.exit(0);
}

testConnections();
