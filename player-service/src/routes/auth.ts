import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    // Notify wallet service asynchronously (fire-and-forget with best effort)
    const walletUrl = process.env.WALLET_SERVICE_URL;
    if (walletUrl) {
      fetch(`${walletUrl}/internal/wallet/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': process.env.SERVICE_API_KEY ?? '',
        },
        body: JSON.stringify({ userId: user.id }),
      }).catch((err) => console.error('[player-service] wallet create failed:', err));
    }

    return res.status(201).json({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token,
    });
  } catch (err) {
    console.error('[/auth/register]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return res.json({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token,
    });
  } catch (err) {
    console.error('[/auth/login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/google — called by API Gateway after Google OAuth
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'googleId and email are required' });
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    let isNew = false;

    if (!user) {
      const base = (name ?? email.split('@')[0]).replace(/\s+/g, '').toLowerCase();
      const suffix = Math.random().toString(36).slice(2, 6);
      const username = `${base}_${suffix}`;

      user = await prisma.user.create({
        data: { email, username, googleId },
      });
      isNew = true;
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    if (isNew) {
      const walletUrl = process.env.WALLET_SERVICE_URL;
      if (walletUrl) {
        fetch(`${walletUrl}/internal/wallet/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.SERVICE_API_KEY ?? '',
          },
          body: JSON.stringify({ userId: user.id }),
        }).catch((err) => console.error('[player-service] wallet create failed:', err));
      }
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return res.json({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token,
    });
  } catch (err) {
    console.error('[/auth/google]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me — verify token and return current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, username: true, role: true, isBanned: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('[/auth/me]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRouter };
