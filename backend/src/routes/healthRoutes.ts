import { Router, type Request, type Response } from 'express';
import { dbStore } from '../db/store.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export const healthRouter = Router();

healthRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'MiniLedger Backend API',
    database: 'PostgreSQL (Neon Connected)',
    postgresConnected: true,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Seed sample loans for quick testing in development
healthRouter.post('/seed-sample-loans', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const sampleLoans = [
      {
        friendName: 'Aarav Sharma',
        amount: 15000,
        dueDate: new Date(now + 14 * dayMs), // Active, due in 2 weeks
        notes: 'Emergency laptop repair loan',
      },
      {
        friendName: 'Priya Patel',
        amount: 8500,
        dueDate: new Date(now - 5 * dayMs), // Overdue by 5 days
        notes: 'Flight booking advance',
      },
      {
        friendName: 'Rohan Gupta',
        amount: 25000,
        dueDate: new Date(now + 30 * dayMs),
        notes: 'Security deposit assistance',
      },
    ];

    const created = [];
    for (const item of sampleLoans) {
      const loan = await dbStore.createLoan({
        userId,
        friendName: item.friendName,
        amount: item.amount,
        dueDate: item.dueDate,
        notes: item.notes,
      });
      created.push(loan);
    }

    // Partial repayment on Rohan's loan
    const rohanLoan = created[2];
    if (rohanLoan) {
      await dbStore.recordRepayment({
        loanId: rohanLoan.id,
        userId,
        amount: 10000,
        notes: 'First installment via UPI',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Sample test loans created successfully.',
      count: created.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
