import mongoose from 'mongoose';
import { User } from './modules/auth/user.model';
import { Workspace } from './modules/workspace/workspace.model';
import { Board, List, Card } from './modules/board/board.model';
import { Conversation, Message } from './modules/chat/chat.model';
import { Subscription } from './modules/billing/billing.model';

// Try multiple candidate URIs from the user's config history
const URIS_TO_TEST = [
  'mongodb+srv://rhrahat16_db_user:JsYHUGqzgCDDQvBx@cluster0.1bzsgga.mongodb.net/nexus?retryWrites=true&w=majority',
  'mongodb+srv://rhrahat16_db_user:adminn@cluster0.wdnkp5l.mongodb.net/nexus?retryWrites=true&w=majority',
  'mongodb+srv://rhrahat16_db_user:adminn@cluster0.1bzsgga.mongodb.net/nexus?retryWrites=true&w=majority',
  'mongodb+srv://rhrahat16_db_user:JsYHUGqzgCDDQvBx@cluster0.wdnkp5l.mongodb.net/nexus?retryWrites=true&w=majority',
];

async function findWorkingAtlasAndSeed() {
  let connectedUri = '';

  for (const uri of URIS_TO_TEST) {
    try {
      console.log(`Trying connection to: ${uri.replace(/:([^:@]+)@/, ':****@')}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
      console.log('✅ Successfully connected to MongoDB Atlas!');
      connectedUri = uri;
      break;
    } catch (err: any) {
      console.log(`❌ Failed: ${err.message}`);
    }
  }

  if (!connectedUri) {
    console.error('\n⚠️ Could not connect to Atlas with any of the candidate passwords.');
    process.exit(1);
  }

  console.log('\nSeeding accounts to connected Atlas cluster...');
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
    console.log(`Created user on Atlas: ${acc.email}`);
  }

  const owner = createdUsers[0].user;
  const admin = createdUsers[1].user;
  const member = createdUsers[2].user;

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
      content: 'Welcome everyone! The MongoDB Atlas cloud database is fully live on Render.',
      readBy: [owner._id, admin._id, member._id],
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

  console.log('\n🎉 ALL ACCOUNTS CREATED ON LIVE MONGODB ATLAS CLUSTER!');
  console.log('Working MONGO_URI to use on Render:');
  console.log(connectedUri);

  await mongoose.disconnect();
  process.exit(0);
}

findWorkingAtlasAndSeed();
