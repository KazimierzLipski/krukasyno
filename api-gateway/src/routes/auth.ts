import { Router } from 'express';
import { config } from '../config';
import { proxy } from '../proxy';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();
const PLAYER = config.services.player;
const WALLET = config.services.wallet;

// POST /auth/register — public
router.post('/register', authLimiter, async (req, res) => {
  await proxy(req, res, { targetUrl: `${PLAYER}/auth/register` });
  // If registration succeeded, also create wallet
  // (player-service does this async; nothing more needed here)
});

// POST /auth/login — public
router.post('/login', authLimiter, async (req, res) => {
  await proxy(req, res, { targetUrl: `${PLAYER}/auth/login` });
});

// POST /auth/google — called by next-auth signIn callback (server-side)
router.post('/google', authLimiter, async (req, res) => {
  await proxy(req, res, { targetUrl: `${PLAYER}/auth/google` });
});

// GET /auth/me — requires JWT
router.get('/me', authMiddleware, async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${PLAYER}/auth/me`,
    userId: req.user!.sub,
    userEmail: req.user!.email,
    userRole: req.user!.role,
  });
});

// ── Admin routes ──────────────────────────────────────
router.get('/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  await proxy(req, res, {
    targetUrl: `${PLAYER}/admin/users${qs ? '?' + qs : ''}`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/admin/users/:id/ban', authMiddleware, requireAdmin, async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${PLAYER}/admin/users/${req.params.id}/ban`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/admin/users/:id/unban', authMiddleware, requireAdmin, async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${PLAYER}/admin/users/${req.params.id}/unban`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.put('/admin/users/:id/role', authMiddleware, requireAdmin, async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${PLAYER}/admin/users/${req.params.id}/role`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

export { router as authRouter };
