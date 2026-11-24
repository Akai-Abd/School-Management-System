import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  quickSigninSchema,
  resetPasswordSchema,
  switchSchoolSchema,
  verifyMfaSchema,
} from '@school-erp/contracts';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';
import { requireAuth, requireCsrf, SESSION_COOKIE_NAME } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  acceptUserInvitation,
  buildAuthMe,
  createPasswordResetToken,
  loginWithPassword,
  quickSigninAsDemoRole,
  resetPasswordWithToken,
  revokeSession,
  setupUserMfa,
  switchActiveSchool,
  verifyAndEnableMfa,
} from './auth.service.js';

export const authRouter = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function setSessionCookie(res: Response, rawSessionToken: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE_NAME, rawSessionToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

function isQuickSigninEnabled(): boolean {
  return env.NODE_ENV !== 'production' && env.ENABLE_DEMO_QUICK_SIGNIN;
}

authRouter.get('/demo-config', (_req, res) => {
  res.json({ quickSigninEnabled: isQuickSigninEnabled() });
});

authRouter.post('/quick-signin', authRateLimiter, validateBody(quickSigninSchema), async (req, res, next) => {
  try {
    if (!isQuickSigninEnabled()) {
      throw Errors.notFound('Quick sign-in is disabled');
    }
    const result = await quickSigninAsDemoRole(req.body.role, {
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
      requestId: req.requestId,
    });
    setSessionCookie(res, result.rawSessionToken, result.expiresAt);
    res.json(result.me);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authRateLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await loginWithPassword(req.body, {
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
      requestId: req.requestId,
    });

    setSessionCookie(res, result.rawSessionToken, result.expiresAt);

    res.json(result.me);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const me = await buildAuthMe(req.auth!.userId, req.auth!.activeSchoolId, req.auth!.csrfToken);
    res.json(me);
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/switch-school',
  requireAuth,
  requireCsrf,
  validateBody(switchSchoolSchema),
  async (req, res, next) => {
    try {
      const me = await switchActiveSchool(
        req.auth!.sessionId,
        req.auth!.userId,
        req.auth!.isPlatformAdmin,
        req.body.schoolId,
        req.auth!.csrfToken,
      );
      res.json(me);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/logout', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    await revokeSession(req.auth!.sessionId, req.auth!.userId, req.auth!.activeSchoolId, req.requestId);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', authRateLimiter, validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    // Email delivery integrates with the communications worker in Phase 4.
    await createPasswordResetToken(req.body.email);
    res.json({ message: 'If the account exists, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', authRateLimiter, validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    await resetPasswordWithToken(req.body);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/accept-invite', authRateLimiter, validateBody(acceptInviteSchema), async (req, res, next) => {
  try {
    await acceptUserInvitation(req.body, req.requestId);
    res.json({ message: 'Invitation accepted. You may now sign in.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/mfa/setup', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const setup = await setupUserMfa(req.auth!.userId, req.auth!.email);
    res.json(setup);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/mfa/verify', requireAuth, requireCsrf, validateBody(verifyMfaSchema), async (req, res, next) => {
  try {
    await verifyAndEnableMfa(req.auth!.userId, req.body.code, req.auth!.activeSchoolId, req.requestId);
    res.json({ mfaEnabled: true });
  } catch (err) {
    next(err);
  }
});
