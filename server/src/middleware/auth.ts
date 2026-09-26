import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { UnauthorizedError } from './errorHandler';
import { getRedisClient } from '../config/redis';

// Extend Express.User namespace from Passport
declare global {
  namespace Express {
    interface User extends AccessTokenPayload {}
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);

    const redis = getRedisClient();
    const isRevoked = await redis.get(`revoked:user:${payload.userId}`);
    if (isRevoked) {
      throw new UnauthorizedError('Session revoked. Please log in again.');
    }

    req.user = payload;
    next();
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Invalid or expired access token'));
    }
  }
}
