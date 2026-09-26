import Redis from 'ioredis';
import mongoose from 'mongoose';
import { env } from './config/env';

async function testUpstash() {
  console.log('Testing Upstash Redis Connection...');
  const redis = new Redis(env.REDIS_URL);

  try {
    await redis.set('nexus_test_key', 'upstash_connected');
    const val = await redis.get('nexus_test_key');
    console.log('✅ Upstash Redis Connected & Verified! Read test:', val);
    await redis.quit();
  } catch (err: any) {
    console.error('❌ Upstash Redis error:', err.message);
  }

  process.exit(0);
}

testUpstash();
