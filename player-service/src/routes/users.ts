import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, serviceKeyMiddleware } from '../middleware/auth';

const router = Router();

// GET /users/:id — fetch single user (service-to-service or auth required)
router.get('/:id', async (req, res) => {
  const serviceKey = req.headers['x-service-key'];
  const isServiceCall = serviceKey === process.env.SERVICE_API_KEY;

  if (!isServiceCall) {
    // Require auth for non-service calls
    authMiddleware(req, res, () => {});
    if (!req.user) return; // authMiddleware already responded
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user });
  } catch (err) {
    console.error('[GET /users/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users — list all users (service-to-service only)
router.get('/', serviceKeyMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isBanned: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return res.json({ users, total, page, limit });
  } catch (err) {
    console.error('[GET /users]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as usersRouter };
