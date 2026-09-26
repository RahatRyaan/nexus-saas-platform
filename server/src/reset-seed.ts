import Redis from 'ioredis';
import mongoose from 'mongoose';
import { User } from './modules/auth/user.model';
import { Workspace } from './modules/workspace/workspace.model';
import { Board, List, Card } from './modules/board/board.model';
import { Subscription } from './modules/billing/billing.model';
import { env } from './config/env';

async function resetAndSeed() {
  console.log('Connecting to Redis...');
  const redis = new Redis(env.REDIS_URL);
  
  console.log('Clearing rate limiter keys in Redis...');
  const rateLimitKeys = await redis.keys('rl:*');
  if (rateLimitKeys.length > 0) {
    await redis.del(...rateLimitKeys);
    console.log(`Deleted ${rateLimitKeys.length} rate limiter keys.`);
  }

  const refreshKeys = await redis.keys('refresh:*');
  if (refreshKeys.length > 0) {
    await redis.del(...refreshKeys);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGO_URI);

  const demoAccounts = [
    { email: 'owner@nexus.app', name: 'Owner User', role: 'owner' as const },
    { email: 'demo@nexus.app', name: 'Demo Admin (Owner)', role: 'owner' as const },
    { email: 'admin@nexus.app', name: 'Admin User', role: 'admin' as const },
    { email: 'member@nexus.app', name: 'Member User', role: 'member' as const },
  ];

  console.log('Removing old demo users...');
  for (const acc of demoAccounts) {
    await User.deleteOne({ email: acc.email });
  }
  await Workspace.deleteOne({ slug: 'acme-corp-workspace' });

  console.log('Creating users...');
  const createdUsers: any[] = [];
  for (const acc of demoAccounts) {
    const user = new User({
      name: acc.name,
      email: acc.email,
      password: 'Password123!',
    });
    await user.save();
    createdUsers.push({ user, role: acc.role });
  }

  const ownerUser = createdUsers.find(u => u.user.email === 'owner@nexus.app')!.user;

  console.log('Creating shared Workspace...');
  const workspace = new Workspace({
    name: 'Acme Corp Workspace',
    slug: 'acme-corp-workspace',
    ownerId: ownerUser._id,
    members: createdUsers.map(u => ({
      userId: u.user._id,
      role: u.role,
      joinedAt: new Date(),
    })),
    plan: 'pro',
  });
  await workspace.save();

  for (const u of createdUsers) {
    u.user.defaultWorkspaceId = workspace._id;
    await u.user.save();
  }

  console.log('Creating demo Kanban board & cards...');
  const board = new Board({
    workspaceId: workspace._id,
    title: 'Product Launch Sprint',
    description: 'Sprint planning and core milestone tracking',
    color: '#4F46E5',
    createdBy: ownerUser._id,
  });
  await board.save();

  const listTodo = await List.create({
    boardId: board._id,
    workspaceId: workspace._id,
    title: 'To Do',
    position: 16384,
  });

  const listInProgress = await List.create({
    boardId: board._id,
    workspaceId: workspace._id,
    title: 'In Progress',
    position: 32768,
  });

  const listDone = await List.create({
    boardId: board._id,
    workspaceId: workspace._id,
    title: 'Done',
    position: 49152,
  });

  await Card.create([
    {
      boardId: board._id,
      listId: listInProgress._id,
      workspaceId: workspace._id,
      title: 'Setup PostgreSQL pgvector HNSW index',
      description: 'Optimize cosine similarity distance queries for RAG',
      priority: 'high',
      position: 16384,
      assignees: [ownerUser._id],
      version: 1,
    },
    {
      boardId: board._id,
      listId: listTodo._id,
      workspaceId: workspace._id,
      title: 'Configure Stripe billing webhook retries',
      description: 'Ensure idempotent event processing with stripeEventIds',
      priority: 'urgent',
      position: 16384,
      assignees: [ownerUser._id],
      version: 1,
    },
    {
      boardId: board._id,
      listId: listDone._id,
      workspaceId: workspace._id,
      title: 'Scaffold JWT refresh token rotation with reuse detection',
      description: 'Invalidate token families upon replay attack',
      priority: 'medium',
      position: 16384,
      assignees: [ownerUser._id],
      version: 1,
    },
  ]);

  await Subscription.create({
    workspaceId: workspace._id,
    stripeCustomerId: 'cus_demo_12345678',
    plan: 'pro',
    status: 'active',
  });

  console.log('\n✅ All rate limits cleared and demo accounts created successfully!');
  console.log('--------------------------------------------------');
  console.log('1. Owner : owner@nexus.app  | Password123!');
  console.log('2. Demo  : demo@nexus.app   | Password123!');
  console.log('3. Admin : admin@nexus.app  | Password123!');
  console.log('4. Member: member@nexus.app | Password123!');
  console.log('--------------------------------------------------');

  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
}

resetAndSeed().catch((err) => {
  console.error('Reset error:', err);
  process.exit(1);
});
