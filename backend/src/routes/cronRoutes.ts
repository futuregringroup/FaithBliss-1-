import express, { Request, Response } from 'express';
import { cleanupExpiredStories } from '../services/storyCleanupService';
import { processDueGlobalSubscriptionRenewals } from '../services/subscriptionRenewalService';

const router = express.Router();

// Vercel sets CRON_SECRET automatically and passes it as a Bearer token on
// scheduled invocations. We reject all other callers to prevent abuse.
const verifyCronSecret = (req: Request, res: Response): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET not set — rejecting cron request');
    res.status(500).json({ message: 'Cron secret not configured.' });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ message: 'Unauthorized.' });
    return false;
  }
  return true;
};

router.get('/cleanup-stories', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    await cleanupExpiredStories();
    res.status(200).json({ ok: true, job: 'cleanup-stories' });
  } catch (error) {
    console.error('Cron: cleanup-stories failed', error);
    res.status(500).json({ ok: false, job: 'cleanup-stories' });
  }
});

router.get('/renew-subscriptions', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    await processDueGlobalSubscriptionRenewals();
    res.status(200).json({ ok: true, job: 'renew-subscriptions' });
  } catch (error) {
    console.error('Cron: renew-subscriptions failed', error);
    res.status(500).json({ ok: false, job: 'renew-subscriptions' });
  }
});

export default router;
