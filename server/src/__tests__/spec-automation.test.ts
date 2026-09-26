import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/auth/user.model';
import { Workspace } from '../modules/workspace/workspace.model';
import { Board, List, Card } from '../modules/board/board.model';
import { Conversation, Message } from '../modules/chat/chat.model';
import { KnowledgeDoc } from '../modules/knowledge/knowledge.model';
import { Subscription } from '../modules/billing/billing.model';

let mongoServer: MongoMemoryServer;
let app: any;

let ownerToken: string;
let adminToken: string;
let memberToken: string;
let workspaceId: string;
let boardId: string;
let listId: string;
let cardId: string;
let conversationId: string;

jest.mock('../config/redis', () => ({
  getRedisClient: () => ({
    setex: jest.fn().mockResolvedValue('OK'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    incrby: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    duplicate: jest.fn().mockReturnValue({}),
  }),
  getBullMqRedisClient: () => ({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  }),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../jobs/embedding.worker', () => ({
  embeddingQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  },
  initEmbeddingWorker: jest.fn(),
}));

jest.mock('../modules/ai/ai.service', () => ({
  AIService: {
    summarize: jest.fn().mockResolvedValue({ summary: 'Automated test summary bullet points', tokensUsed: 100 }),
    suggestTasks: jest.fn().mockResolvedValue({
      tasks: [
        { title: 'Task 1', priority: 'high', description: 'Test desc 1' },
        { title: 'Task 2', priority: 'medium', description: 'Test desc 2' },
      ],
    }),
    ask: jest.fn().mockResolvedValue({ answer: 'Automated test RAG answer', sources: [] }),
    checkAndTrackUsage: jest.fn().mockResolvedValue(undefined),
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
  },
}));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Register Owner
  const ownerRes = await request(app).post('/api/auth/register').send({
    name: 'Owner User',
    email: 'test-owner@nexus.app',
    password: 'Password123!',
  });
  ownerToken = ownerRes.body.accessToken;
  workspaceId = ownerRes.body.user.defaultWorkspaceId;

  // 2. Register Admin & Member
  const adminRes = await request(app).post('/api/auth/register').send({
    name: 'Admin User',
    email: 'test-admin@nexus.app',
    password: 'Password123!',
  });
  adminToken = adminRes.body.accessToken;

  const memberRes = await request(app).post('/api/auth/register').send({
    name: 'Member User',
    email: 'test-member@nexus.app',
    password: 'Password123!',
  });
  memberToken = memberRes.body.accessToken;

  // Add Admin & Member to Owner's Workspace
  const ws = await Workspace.findById(workspaceId);
  ws!.members.push(
    { userId: new mongoose.Types.ObjectId(adminRes.body.user.id), role: 'admin', joinedAt: new Date() },
    { userId: new mongoose.Types.ObjectId(memberRes.body.user.id), role: 'member', joinedAt: new Date() },
  );
  ws!.plan = 'pro';
  await ws!.save();

  // Create active subscription
  await Subscription.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    stripeCustomerId: 'cus_test_123',
    plan: 'pro',
    status: 'active',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('=== NEXUS SPECIFICATION FULL AUTOMATION TEST SUITE ===', () => {
  // -------------------------------------------------------------
  // MODULE 1: AUTH & WORKSPACE SYSTEM
  // -------------------------------------------------------------
  describe('Module 1: Auth & Workspace System', () => {
    it('1.1 Login generates valid access token', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test-owner@nexus.app',
        password: 'Password123!',
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('1.2 Create Workspace (POST /api/workspaces)', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Secondary Test Workspace' });
      expect(res.status).toBe(201);
      expect(res.body.workspace).toHaveProperty('name', 'Secondary Test Workspace');
    });

    it('1.3 Invite Member (POST /api/workspaces/:id/invite)', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'newcolleague@nexus.app', role: 'member' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inviteToken');
    });

    it('1.4 Get Workspace Activity Log (GET /api/workspaces/:id/activity)', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/activity`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
    });
  });

  // -------------------------------------------------------------
  // MODULE 2: KANBAN BOARDS (REAL-TIME)
  // -------------------------------------------------------------
  describe('Module 2: Kanban Boards', () => {
    it('2.1 Create Board (POST /api/boards)', async () => {
      const res = await request(app)
        .post('/api/boards')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          workspaceId,
          title: 'Sprint 1 Roadmap',
          description: 'Q4 deliverables',
          color: '#4F46E5',
        });
      expect(res.status).toBe(201);
      expect(res.body.board).toHaveProperty('title', 'Sprint 1 Roadmap');
      boardId = res.body.board._id;
    });

    it('2.2 Get Board with default lists (GET /api/boards/:id)', async () => {
      const res = await request(app)
        .get(`/api/boards/${boardId}`)
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.lists.length).toBe(3);
      listId = res.body.lists[0]._id;
    });

    it('2.3 Create Card (POST /api/boards/:boardId/lists/:listId/cards)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/lists/${listId}/cards`)
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Setup PostgreSQL pgvector',
          description: 'Cosine similarity embeddings',
          priority: 'urgent',
        });
      expect(res.status).toBe(201);
      expect(res.body.card).toHaveProperty('title', 'Setup PostgreSQL pgvector');
      cardId = res.body.card._id;
    });

    it('2.4 Move Card with Fractional Indexing & Optimistic Lock (POST /move)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/cards/${cardId}/move`)
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          targetListId: listId,
          previousCardId: null,
          nextCardId: null,
          version: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.card.version).toBe(2);
    });

    it('2.5 Reject Concurrent Move with outdated version (Optimistic lock)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/cards/${cardId}/move`)
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          targetListId: listId,
          version: 1,
        });
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------
  // MODULE 3: REAL-TIME TEAM CHAT
  // -------------------------------------------------------------
  describe('Module 3: Real-Time Team Chat', () => {
    it('3.1 Create Conversation (POST /api/chat/conversations)', async () => {
      const adminUser = await User.findOne({ email: 'test-admin@nexus.app' });
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          workspaceId,
          type: 'group',
          name: 'Engineering General',
          participantIds: [adminUser!._id.toString()],
        });
      expect(res.status).toBe(201);
      conversationId = res.body.conversation._id;
    });

    it('3.2 Send Message & Persist in MongoDB (POST /messages)', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Hello team, the backend test suite is running.',
        });
      expect(res.status).toBe(201);
      expect(res.body.message).toHaveProperty('content', 'Hello team, the backend test suite is running.');
    });

    it('3.3 Get Conversation Message History (GET /messages)', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages`)
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // MODULE 4: KNOWLEDGE BASE (RAG)
  // -------------------------------------------------------------
  describe('Module 4: Knowledge Base', () => {
    it('4.1 List Knowledge Documents (GET /api/knowledge)', async () => {
      const res = await request(app)
        .get('/api/knowledge')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('documents');
    });
  });

  // -------------------------------------------------------------
  // MODULE 5: AI ASSISTANT LAYER
  // -------------------------------------------------------------
  describe('Module 5: AI Assistant Suite', () => {
    it('5.1 AI Executive Summarizer (POST /api/ai/summarize)', async () => {
      const res = await request(app)
        .post('/api/ai/summarize')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          text: 'This is a test document covering architectural decisions including fractional indexing, Socket.io Redis adapters, and Stripe webhook idempotency.',
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
    });

    it('5.2 AI Task Generator (POST /api/ai/suggest-tasks)', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-tasks')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          goal: 'Implement user avatar uploads with Cloudinary',
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
    });

    it('5.3 AI RAG Q&A (POST /api/ai/ask)', async () => {
      const res = await request(app)
        .post('/api/ai/ask')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          question: 'What is the primary database architecture for Nexus?',
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('answer');
    });
  });

  // -------------------------------------------------------------
  // MODULE 6: BILLING & PLAN GATING
  // -------------------------------------------------------------
  describe('Module 6: Billing & Plan Gating', () => {
    it('6.1 Get Billing Subscription Status (GET /api/billing/status)', async () => {
      const res = await request(app)
        .get('/api/billing/status')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.subscription).toHaveProperty('plan', 'pro');
    });

    it('6.2 Reject Non-Owner on Stripe Checkout (RBAC Gate)', async () => {
      const res = await request(app)
        .post('/api/billing/checkout')
        .query({ workspaceId })
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------
  // MODULE 7: PLATFORM & SYSTEM ENDPOINTS
  // -------------------------------------------------------------
  describe('Module 7: Platform Health & Reliability', () => {
    it('7.1 Health Check (GET /health) returns 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('uptime');
    });
  });
});
