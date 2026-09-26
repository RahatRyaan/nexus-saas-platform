import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from './user.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { getRedisClient } from '../../config/redis';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../../middleware/errorHandler';
import { RegisterInput, LoginInput } from './auth.schema';
import { Workspace } from '../workspace/workspace.model';

const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    defaultWorkspaceId?: string;
  };
}

export class AuthService {
  private static async createTokenFamily(
    userId: string,
    workspaceId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenFamily = uuidv4();
    const redis = getRedisClient();

    const user = await User.findById(userId).lean();
    if (!user) throw new NotFoundError('User');

    const accessToken = signAccessToken({
      userId: (user as any)._id.toString(),
      email: (user as any).email,
      workspaceId,
    });

    const refreshToken = signRefreshToken({
      userId: (user as any)._id.toString(),
      tokenFamily,
    });

    // Store active token family in Redis
    await redis.setex(
      `refresh:${userId}:${tokenFamily}`,
      REFRESH_TOKEN_EXPIRY,
      'valid',
    );

    return { accessToken, refreshToken };
  }

  static async register(input: RegisterInput): Promise<AuthTokens> {
    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const user = new User({
      name: input.name,
      email: input.email,
      password: input.password,
    });
    await user.save();

    // Auto-create personal workspace for new user
    const workspace = new Workspace({
      name: `${input.name}'s Workspace`,
      slug: `${input.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`,
      ownerId: user._id,
      members: [{ userId: user._id, role: 'owner' }],
    });
    await workspace.save();

    user.defaultWorkspaceId = workspace._id;
    await user.save();

    const tokens = await this.createTokenFamily(
      user._id.toString(),
      workspace._id.toString(),
    );

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        defaultWorkspaceId: workspace._id.toString(),
      },
    };
  }

  static async login(input: LoginInput): Promise<AuthTokens> {
    const user = await User.findOne({ email: input.email }).select('+password');
    if (!user || !user.password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = await this.createTokenFamily(
      user._id.toString(),
      user.defaultWorkspaceId?.toString(),
    );

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        defaultWorkspaceId: user.defaultWorkspaceId?.toString(),
      },
    };
  }

  static async rotateRefreshToken(token: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const { userId, tokenFamily } = payload;
    const redis = getRedisClient();

    // Check if this token family exists and is valid
    const status = await redis.get(`refresh:${userId}:${tokenFamily}`);

    if (!status) {
      // Reuse detection: token family was already rotated or invalidated
      // Revoke ALL token families for this user (potential token theft!)
      const keys = await redis.keys(`refresh:${userId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      throw new UnauthorizedError('Refresh token reuse detected. Please log in again.');
    }

    // Invalidate the old token family immediately (single-use)
    await redis.del(`refresh:${userId}:${tokenFamily}`);

    const user = await User.findById(userId).lean();
    if (!user) throw new NotFoundError('User');

    // Issue a brand new token family
    const newTokens = await this.createTokenFamily(
      userId,
      (user as any).defaultWorkspaceId?.toString(),
    );

    return {
      ...newTokens,
      user: {
        id: (user as any)._id.toString(),
        name: (user as any).name,
        email: (user as any).email,
        avatar: (user as any).avatar,
        defaultWorkspaceId: (user as any).defaultWorkspaceId?.toString(),
      },
    };
  }

  static async logout(userId: string, token?: string): Promise<void> {
    const redis = getRedisClient();
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await redis.del(`refresh:${userId}:${payload.tokenFamily}`);
      } catch {
        // Token invalid, clear all families
        const keys = await redis.keys(`refresh:${userId}:*`);
        if (keys.length > 0) await redis.del(...keys);
      }
    } else {
      const keys = await redis.keys(`refresh:${userId}:*`);
      if (keys.length > 0) await redis.del(...keys);
    }
  }

  static async handleGoogleAuth(profile: {
    id: string;
    displayName: string;
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
  }): Promise<AuthTokens> {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new UnauthorizedError('Google account has no email');

    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

    if (!user) {
      user = new User({
        name: profile.displayName || email.split('@')[0],
        email,
        googleId: profile.id,
        avatar: profile.photos?.[0]?.value || '',
      });
      await user.save();

      const workspace = new Workspace({
        name: `${user.name}'s Workspace`,
        slug: `${user.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner' }],
      });
      await workspace.save();

      user.defaultWorkspaceId = workspace._id;
      await user.save();
    } else if (!user.googleId) {
      user.googleId = profile.id;
      if (!user.avatar && profile.photos?.[0]?.value) {
        user.avatar = profile.photos[0].value;
      }
      await user.save();
    }

    const tokens = await this.createTokenFamily(
      user._id.toString(),
      user.defaultWorkspaceId?.toString(),
    );

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        defaultWorkspaceId: user.defaultWorkspaceId?.toString(),
      },
    };
  }
}
