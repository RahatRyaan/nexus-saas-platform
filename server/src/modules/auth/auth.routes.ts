import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';
import { upload } from '../../utils/fileUpload';
import { AuthService } from './auth.service';
import { env } from '../../config/env';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from './user.model';
import { uploadToCloudinary } from '../../utils/fileUpload';

export const authRouter = Router();

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const result = await AuthService.handleGoogleAuth(profile);
          done(null, result as any);
        } catch (err) {
          done(err, undefined);
        }
      },
    ),
  );
}

authRouter.post('/register', authRateLimiter, asyncHandler(AuthController.register));
authRouter.post('/login', authRateLimiter, asyncHandler(AuthController.login));
authRouter.post('/refresh-token', asyncHandler(AuthController.refreshToken));
authRouter.post('/logout', authenticate, asyncHandler(AuthController.logout));
authRouter.get('/me', authenticate, asyncHandler(AuthController.me));

// Profile management routes
authRouter.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.userId).select('-password');
  res.status(200).json({ user });
}));

authRouter.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { $set: { ...(name && { name }), ...(avatar && { avatar }) } },
    { new: true },
  ).select('-password');
  res.status(200).json({ user });
}));

authRouter.post('/profile/avatar', authenticate, upload.single('avatar'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Avatar file is required' });
    return;
  }

  let avatarUrl = '';
  try {
    const result = await uploadToCloudinary(file.buffer, file.mimetype, 'avatars', `user_${req.user!.userId}`);
    avatarUrl = result.url;
  } catch {
    // Fallback data url if Cloudinary not reachable
    avatarUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }

  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { $set: { avatar: avatarUrl } },
    { new: true },
  ).select('-password');

  res.status(200).json({ user, avatarUrl });
}));

// Google OAuth routes
authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
);

authRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.CLIENT_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const result = req.user as any;
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(`${env.CLIENT_URL}/auth/callback?token=${result.accessToken}`);
  },
);
