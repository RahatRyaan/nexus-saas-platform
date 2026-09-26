import mongoose from 'mongoose';
import Redis from 'ioredis';
import { User } from './modules/auth/user.model';
import { Workspace } from './modules/workspace/workspace.model';
import { Board, List, Card } from './modules/board/board.model';
import { Conversation, Message } from './modules/chat/chat.model';
import { KnowledgeDoc } from './modules/knowledge/knowledge.model';
import { Subscription } from './modules/billing/billing.model';
import { env } from './config/env';

async function seedCompleteWorkspace() {
  console.log('Connecting to MongoDB at:', env.MONGO_URI);
  await mongoose.connect(env.MONGO_URI);

  const redis = new Redis(env.REDIS_URL);
  const rateLimitKeys = await redis.keys('rl:*');
  if (rateLimitKeys.length > 0) await redis.del(...rateLimitKeys);

  // 1. Create Demo Accounts
  const demoAccounts = [
    { email: 'owner@nexus.app', name: 'Rahat (Owner)', role: 'owner' as const },
    { email: 'admin@nexus.app', name: 'Sarah Connor (Admin)', role: 'admin' as const },
    { email: 'member@nexus.app', name: 'Alex Rivera (Dev Lead)', role: 'member' as const },
  ];

  const createdUsers: any[] = [];
  for (const acc of demoAccounts) {
    await User.deleteOne({ email: acc.email });
    const user = new User({
      name: acc.name,
      email: acc.email,
      password: 'Password123!',
    });
    await user.save();
    createdUsers.push({ user, role: acc.role });
  }

  const owner = createdUsers[0].user;
  const admin = createdUsers[1].user;
  const member = createdUsers[2].user;

  // 2. Create Shared SaaS Workspace
  await Workspace.deleteOne({ slug: 'acme-corp-workspace' });
  const workspace = new Workspace({
    name: 'Acme SaaS Platform',
    slug: 'acme-corp-workspace',
    ownerId: owner._id,
    members: createdUsers.map((u) => ({
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

  // 3. Create Product & Engineering Kanban Boards
  const productBoard = new Board({
    workspaceId: workspace._id,
    title: 'Q4 Product Roadmap & Releases',
    description: 'Feature milestones, user research, and deployment tracking',
    color: '#4F46E5',
    createdBy: owner._id,
  });
  await productBoard.save();

  const todoList = await List.create({
    boardId: productBoard._id,
    workspaceId: workspace._id,
    title: 'Backlog & Ideas',
    position: 16384,
  });

  const inProgressList = await List.create({
    boardId: productBoard._id,
    workspaceId: workspace._id,
    title: 'In Development',
    position: 32768,
  });

  const reviewList = await List.create({
    boardId: productBoard._id,
    workspaceId: workspace._id,
    title: 'Code Review & QA',
    position: 49152,
  });

  const doneList = await List.create({
    boardId: productBoard._id,
    workspaceId: workspace._id,
    title: 'Shipped to Prod',
    position: 65536,
  });

  await Card.create([
    {
      boardId: productBoard._id,
      listId: inProgressList._id,
      workspaceId: workspace._id,
      title: 'AI Semantic Document Search (RAG)',
      description: 'Integrate pgvector cosine similarity search on uploaded PDFs and docs.',
      priority: 'urgent',
      position: 16384,
      assignees: [member._id],
      labels: ['AI', 'Backend'],
      version: 1,
    },
    {
      boardId: productBoard._id,
      listId: inProgressList._id,
      workspaceId: workspace._id,
      title: 'SSLCommerz Bangladesh Payment Gateway',
      description: 'Implement seamless checkout flow for BDT transactions with sandbox testbox.',
      priority: 'high',
      position: 32768,
      assignees: [admin._id],
      labels: ['Billing', 'Payments'],
      version: 1,
    },
    {
      boardId: productBoard._id,
      listId: reviewList._id,
      workspaceId: workspace._id,
      title: 'Real-time Kanban Drag-and-Drop Sync',
      description: 'Fractional indexing with Socket.io cardMoved broadcast room.',
      priority: 'high',
      position: 16384,
      assignees: [owner._id],
      labels: ['Frontend', 'Realtime'],
      version: 1,
    },
    {
      boardId: productBoard._id,
      listId: doneList._id,
      workspaceId: workspace._id,
      title: 'JWT Refresh Token Rotation with Reuse Invalidation',
      description: 'Cryptographic token family invalidation in Redis on token theft.',
      priority: 'medium',
      position: 16384,
      assignees: [member._id],
      labels: ['Security'],
      version: 1,
    },
  ]);

  // 4. Create Public Workspace Channel with ALL Members
  await Conversation.deleteMany({ workspaceId: workspace._id });
  const chatRoom = new Conversation({
    workspaceId: workspace._id,
    type: 'channel',
    name: 'General Product Discussion',
    participants: [owner._id, admin._id, member._id],
  });
  await chatRoom.save();

  await Message.create([
    {
      conversationId: chatRoom._id,
      workspaceId: workspace._id,
      senderId: owner._id,
      content: 'Welcome everyone! The MongoDB Atlas and Redis cluster are now live.',
      readBy: [owner._id, admin._id, member._id],
    },
    {
      conversationId: chatRoom._id,
      workspaceId: workspace._id,
      senderId: admin._id,
      content: 'Awesome! SSLCommerz sandbox credentials and Cloudinary are connected.',
      readBy: [owner._id, admin._id, member._id],
    },
    {
      conversationId: chatRoom._id,
      workspaceId: workspace._id,
      senderId: member._id,
      content: 'Working on pgvector embedding indexes for the Knowledge Base today!',
      readBy: [owner._id, admin._id, member._id],
    },
  ]);

  // 5. Create Knowledge Docs & Subscriptions
  await KnowledgeDoc.deleteMany({ workspaceId: workspace._id });
  await KnowledgeDoc.create([
    {
      workspaceId: workspace._id,
      title: 'Nexus SaaS Architecture Blueprint & ADRs',
      filename: 'architecture-v1.pdf',
      fileUrl: 'https://res.cloudinary.com/wxhozv3w/raw/upload/docs/architecture.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      chunkCount: 14,
      embeddingStatus: 'ready',
      uploadedBy: owner._id,
    },
    {
      workspaceId: workspace._id,
      title: 'SSLCommerz Integration & Webhook Guide',
      filename: 'sslcommerz-spec.pdf',
      fileUrl: 'https://res.cloudinary.com/wxhozv3w/raw/upload/docs/sslcommerz.pdf',
      fileSize: 524288,
      mimeType: 'application/pdf',
      chunkCount: 8,
      embeddingStatus: 'ready',
      uploadedBy: admin._id,
    },
  ]);

  await Subscription.findOneAndUpdate(
    { workspaceId: workspace._id },
    {
      stripeCustomerId: 'cus_live_demo_acme',
      plan: 'pro',
      status: 'active',
    },
    { upsert: true },
  );

  console.log('\n🎉 ALL ROLES AND DATA SEEDED IN SHARED WORKSPACE!');
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
}

seedCompleteWorkspace().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
