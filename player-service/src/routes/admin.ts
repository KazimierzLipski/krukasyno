import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = Router();

// All admin routes require JWT + ADMIN role
router.use(authMiddleware, requireAdmin);

// GET /admin/users — list users with pagination
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) ?? '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { username: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
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
      prisma.user.count({ where }),
    ]);

    return res.json({ users, total, page, limit });
  } catch (err) {
    console.error('[GET /admin/users]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/users/:id/ban
router.post('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'ADMIN') return res.status(400).json({ error: 'Cannot ban admin' });

    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: true },
      select: { id: true, email: true, username: true, isBanned: true },
    });

    return res.json({ user: updated, message: 'User banned' });
  } catch (err) {
    console.error('[POST /admin/users/:id/ban]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/users/:id/unban
router.post('/users/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: false },
      select: { id: true, email: true, username: true, isBanned: true },
    });

    return res.json({ user: updated, message: 'User unbanned' });
  } catch (err) {
    console.error('[POST /admin/users/:id/unban]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /admin/users/:id/role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent self-demotion
    if (id === req.user!.sub && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, username: true, role: true },
    });

    return res.json({ user: updated });
  } catch (err) {
    console.error('[PUT /admin/users/:id/role]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as adminRouter };
