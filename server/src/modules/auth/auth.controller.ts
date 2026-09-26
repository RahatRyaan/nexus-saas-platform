import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.schema';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const input = registerSchema.parse(req.body);
    const result = await AuthService.register(input);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  static async login(req: Request, res: Response): Promise<void> {
    const input = loginSchema.parse(req.body);
    const result = await AuthService.login(input);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  static async refreshToken(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const result = await AuthService.rotateRefreshToken(token);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.refreshToken;
    if (req.user) {
      await AuthService.logout(req.user.userId, token);
    }

    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    res.status(200).json({ message: 'Logged out successfully' });
  }

  static async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({ user: req.user });
  }
}
