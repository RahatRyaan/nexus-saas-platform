import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClient } from '../config/redis';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    workspaceId?: string;
    email: string;
  };
}

let ioInstance: SocketServer | null = null;

export function getIO(): SocketServer {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized');
  }
  return ioInstance;
}

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  try {
    const pubClient = getRedisClient();
    const subClient = pubClient.duplicate();
    subClient.on('error', (err) => logger.warn(`Redis subClient pending: ${err.message || 'offline'}`));
    io.adapter(createAdapter(pubClient, subClient));
  } catch (err: any) {
    logger.warn('Socket.io Redis adapter init fallback to memory adapter', { err: err.message });
  }

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data = {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        email: payload.email,
      };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, workspaceId } = socket.data;
    logger.info(`Socket connected: ${socket.id} (user: ${userId})`);

    // Join personal user room for targeted notifications
    await socket.join(`user:${userId}`);

    try {
      const redis = getRedisClient();
      await redis.sadd(`online:users`, userId);
      if (workspaceId) {
        await socket.join(`workspace:${workspaceId}`);
        await redis.sadd(`presence:ws:${workspaceId}`, userId);
        io.to(`workspace:${workspaceId}`).emit('presenceUpdate', {
          userId,
          status: 'online',
        });
      }
    } catch {
      // Non-blocking
    }

    // Room join handlers
    socket.on('join:board', async (boardId: string) => {
      await socket.join(`board:${boardId}`);
      logger.debug(`Socket ${socket.id} joined board:${boardId}`);
    });

    socket.on('leave:board', async (boardId: string) => {
      await socket.leave(`board:${boardId}`);
    });

    socket.on('join:chat', async (roomId: string) => {
      await socket.join(`chat:${roomId}`);
    });

    socket.on('leave:chat', async (roomId: string) => {
      await socket.leave(`chat:${roomId}`);
    });

    // Real-time Kanban card move
    socket.on('cardMoved', (data: {
      boardId: string;
      cardId: string;
      listId: string;
      position: number;
      version: number;
    }) => {
      socket.to(`board:${data.boardId}`).emit('cardMoved', {
        ...data,
        movedBy: userId,
      });
    });

    // Chat events
    socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
      socket.to(`chat:${data.roomId}`).emit('typing', {
        roomId: data.roomId,
        userId,
        isTyping: data.isTyping,
      });
    });

    // Clean up on disconnect
    socket.on('disconnecting', async () => {
      const rooms = Array.from(socket.rooms);
      logger.info(`Socket disconnecting: ${socket.id} (rooms: ${rooms.join(', ')})`);

      try {
        const redis = getRedisClient();
        const sockets = await io.in(`user:${userId}`).fetchSockets();
        if (sockets.length <= 1) {
          await redis.srem(`online:users`, userId);
          if (workspaceId) {
            await redis.srem(`presence:ws:${workspaceId}`, userId);
            io.to(`workspace:${workspaceId}`).emit('presenceUpdate', {
              userId,
              status: 'offline',
            });
          }
        }
      } catch {
        // Non-blocking
      }
    });
  });

  ioInstance = io;
  return io;
}
