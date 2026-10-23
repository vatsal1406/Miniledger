import { Router, type Request, type Response } from 'express';
import { dbStore } from '../db/store.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export const dashboardRouter = Router();

// Protect dashboard routes
dashboardRouter.use(authMiddleware);

// GET /api/dashboard/summary - Summary metrics and recent loans
dashboardRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = await dbStore.getDashboardSummary(userId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
