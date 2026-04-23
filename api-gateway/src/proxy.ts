/**
 * Generic proxy helper.
 * Forwards req to targetUrl, injecting service headers,
 * and writes the service response back to res.
 */
import { Request, Response } from 'express';
import { config } from './config';

interface ProxyOptions {
  targetUrl: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  /** Replace body with this object instead of the original body */
  overrideBody?: unknown;
}

export async function proxy(req: Request, res: Response, opts: ProxyOptions): Promise<void> {
  const { targetUrl, userId, userEmail, userRole, overrideBody } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Service-Key': config.serviceApiKey,
    'X-Forwarded-For': (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '',
  };

  if (userId) headers['X-User-Id'] = userId;
  if (userEmail) headers['X-User-Email'] = userEmail;
  if (userRole) headers['X-User-Role'] = userRole;

  // Forward original Authorization header so downstream can optionally re-verify
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  const body = overrideBody !== undefined
    ? JSON.stringify(overrideBody)
    : req.method !== 'GET' && req.method !== 'HEAD'
      ? JSON.stringify(req.body)
      : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    const text = await upstream.text();

    res.status(upstream.status);
    if (contentType.includes('application/json')) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.send(text);
  } catch (err) {
    console.error(`[proxy] ${targetUrl} error:`, err);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
}
