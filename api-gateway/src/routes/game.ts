import { Router } from 'express';
import { config } from '../config';
import { proxy } from '../proxy';
import { authMiddleware } from '../middleware/auth';
import { gameLimiter } from '../middleware/rateLimiter';

const router = Router();
const GAME = config.services.game;

router.use(authMiddleware, gameLimiter);

// Blackjack
router.post('/blackjack/start', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${GAME}/games/blackjack/start`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.get('/blackjack/state', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${GAME}/games/blackjack/state`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/blackjack/hit', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${GAME}/games/blackjack/hit`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/blackjack/stand', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${GAME}/games/blackjack/stand`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/blackjack/double', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${GAME}/games/blackjack/double`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

// Slots
router.post('/slots/spin', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${GAME}/games/slots/spin`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

export { router as gameRouter };
