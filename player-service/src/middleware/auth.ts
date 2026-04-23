import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../lib/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Support both Authorization header and X-User-Id from API Gateway
  if (req.headers['x-user-id']) {
    req.user = {
      sub: req.headers['x-user-id'] as string,
      email: req.headers['x-user-email'] as string ?? '',
      role: req.headers['x-user-role'] as string ?? 'USER',
    };
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function serviceKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-service-key'];
  if (key !== process.env.SERVICE_API_KEY) {
    res.status(403).json({ error: 'Invalid service key' });
    return;
  }
  next();
}
