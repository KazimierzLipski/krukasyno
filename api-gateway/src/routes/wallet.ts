import { Router } from 'express';
import { config } from '../config';
import { proxy } from '../proxy';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const WALLET = config.services.wallet;

router.use(authMiddleware);

router.get('/balance', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${WALLET}/wallet/balance`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/deposit', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${WALLET}/wallet/deposit`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.post('/withdraw', async (req, res) => {
  await proxy(req, res, {
    targetUrl: `${WALLET}/wallet/withdraw`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

router.get('/transactions', async (req, res) => {
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  await proxy(req, res, {
    targetUrl: `${WALLET}/wallet/transactions${qs ? '?' + qs : ''}`,
    userId: req.user!.sub,
    userRole: req.user!.role,
  });
});

export { router as walletRouter };
