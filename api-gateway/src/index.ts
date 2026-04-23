import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import { generalLimiter } from './middleware/rateLimiter';
import { authRouter } from './routes/auth';
import { gameRouter } from './routes/game';
import { walletRouter } from './routes/wallet';

const app = express();

// ── Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(morgan('combined'));
app.use(generalLimiter);

// ── Health ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/games', gameRouter);
app.use('/wallet', walletRouter);

// ── 404 ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start ─────────────────────────────────────────────
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api-gateway] Listening on port ${config.port}`);
});

export default app;
