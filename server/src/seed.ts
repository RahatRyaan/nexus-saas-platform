import mongoose from 'mongoose';
import { User } from './modules/auth/user.model';
import { Workspace } from './modules/workspace/workspace.model';
import { Board, List, Card } from './modules/board/board.model';
import { Subscription } from './modules/billing/billing.model';
import { env } from './config/env';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGO_URI);

  console.log('Clearing old demo user if exists...');
  await User.deleteOne({ email: 'demo@nexus.app' }).catch(() => {});

  console.log('Creating demo user...');
  const user = new User({
    name: 'Demo Admin',
    email: 'demo@nexus.app',
    password: 'Password123!',
  });
  await user.save();

  console.log('Creating demo workspace...');
  const workspace = new Workspace({
    name: 'Acme Corp Workspace',
    slug: 'acme-corp-demo',
    ownerId: user._id,
    members: [{ userId: user._id, role: 'owner' }],
    plan: 'pro',
  });
  await workspace.save();

  user.defaultWorkspaceId = workspace._id;
  await user.save();

  console.log('Creating demo board & tasks...');
  const board = new Board({
    workspaceId: workspace._id,
    title: 'Product Launch Sprint',
    description: 'Sprint planning and core milestone tracking',
    color: '#4F46E5',
    createdBy: user._id,
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
      assignees: [user._id],
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
      assignees: [user._id],
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
      assignees: [user._id],
      version: 1,
    },
  ]);

  console.log('Creating demo Pro subscription...');
  await Subscription.create({
    workspaceId: workspace._id,
    stripeCustomerId: 'cus_demo_12345678',
    plan: 'pro',
    status: 'active',
  });

  console.log('\n🎉 Demo account created successfully!');
  console.log('Email: demo@nexus.app');
  console.log('Password: Password123!');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
