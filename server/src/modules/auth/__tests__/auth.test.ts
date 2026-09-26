import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../app';
import { User } from '../user.model';
import { Workspace } from '../../workspace/workspace.model';

let mongoServer: MongoMemoryServer;
let app: any;

jest.mock('../../../config/redis', () => ({
  getRedisClient: () => ({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    duplicate: jest.fn().mockReturnValue({}),
  }),
  getBullMqRedisClient: () => ({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  }),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../jobs/embedding.worker', () => ({
  embeddingQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  },
  initEmbeddingWorker: jest.fn(),
}));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Workspace.deleteMany({});
});

describe('Auth Module Integration Tests', () => {
  const validUser = {
    name: 'Test User',
    email: 'test@nexus.app',
    password: 'Password123!',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user and create their default workspace', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toHaveProperty('email', validUser.email);
      expect(res.body.user).toHaveProperty('defaultWorkspaceId');
      expect(res.headers['set-cookie']).toBeDefined();

      const user = await User.findOne({ email: validUser.email });
      expect(user).not.toBeNull();
      expect(user?.name).toBe(validUser.name);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration', async () => {
      await request(app).post('/api/auth/register').send(validUser);
      const res = await request(app).post('/api/auth/register').send(validUser);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(validUser.email);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@nexus.app', password: validUser.password });

      expect(res.status).toBe(401);
    });
  });
});
