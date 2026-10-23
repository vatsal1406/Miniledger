import { Router, type Request, type Response } from 'express';
import { dbStore } from '../db/store.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { storageService } from '../services/storageService.js';

export const loanRouter = Router();

// Protect all loan routes
loanRouter.use(authMiddleware);

// GET /api/loans - List loans with filter & search
loanRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { search, status } = req.query;

    const loans = await dbStore.listLoans({
      userId,
      search: search ? String(search) : undefined,
      status: status ? String(status).toUpperCase() : undefined,
    });

    res.status(200).json({
      success: true,
      data: loans,
      count: loans.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/loans/:id - Get loan details with repayment history
loanRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid loan ID parameter.' });
      return;
    }

    const loan = await dbStore.getLoanById(id, userId);
    if (!loan) {
      res.status(404).json({ success: false, error: 'Loan not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: loan,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/loans - Create a new loan
loanRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { friendName, amount, dueDate, notes, receipt } = req.body;

    if (!friendName || typeof friendName !== 'string' || !friendName.trim()) {
      res.status(400).json({ success: false, error: "Friend's name is required." });
      return;
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ success: false, error: 'Loan amount must be a positive number.' });
      return;
    }

    if (!dueDate) {
      res.status(400).json({ success: false, error: 'Due date is required.' });
      return;
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      res.status(400).json({ success: false, error: 'Please provide a valid due date.' });
      return;
    }

    // Validate optional receipt payload if provided
    let receiptData = null;
    if (receipt && typeof receipt === 'object') {
      if (!receipt.url || typeof receipt.url !== 'string') {
        res.status(400).json({ success: false, error: 'Invalid receipt data: url is required.' });
        return;
      }
      receiptData = {
        url: String(receipt.url),
        publicId: receipt.publicId ? String(receipt.publicId) : null,
        originalFilename: receipt.originalFilename ? String(receipt.originalFilename) : null,
        mimeType: receipt.mimeType ? String(receipt.mimeType) : null,
        sizeBytes: receipt.sizeBytes ? Number(receipt.sizeBytes) : null,
      };
    }

    let loan;
    try {
      loan = await dbStore.createLoan({
        userId,
        friendName: friendName.trim(),
        amount: parsedAmount,
        dueDate: parsedDueDate,
        notes: notes ? String(notes).trim() : null,
        receipt: receiptData,
      });
    } catch (createErr) {
      if (receiptData?.publicId) {
        await storageService.deleteReceipt(receiptData.publicId).catch(() => {});
      }
      throw createErr;
    }

    res.status(201).json({
      success: true,
      message: 'Loan created successfully.',
      data: loan,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/loans/:id/repay - Record partial or full repayment
loanRouter.patch('/:id/repay', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { amount, notes, repaymentDate } = req.body;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid loan ID.' });
      return;
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ success: false, error: 'Repayment amount must be a positive number.' });
      return;
    }

    let parsedDate: Date | undefined;
    if (repaymentDate) {
      parsedDate = new Date(repaymentDate);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({ success: false, error: 'Invalid repayment date.' });
        return;
      }
    }

    const result = await dbStore.recordRepayment({
      loanId: id,
      userId,
      amount: parsedAmount,
      notes: notes ? String(notes).trim() : null,
      repaymentDate: parsedDate,
    });

    res.status(200).json({
      success: true,
      message:
        result.loan.remainingBalance === 0
          ? 'Loan has been completely repaid!'
          : 'Repayment recorded successfully.',
      data: {
        loan: result.loan,
        repayment: result.repayment,
      },
    });
  } catch (err) {
    const message = (err as Error).message || 'Repayment failed.';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: message });
  }
});

// PATCH /api/loans/:id/mark-repaid - Mark entire loan as repaid
loanRouter.patch('/:id/mark-repaid', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { notes } = req.body;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid loan ID.' });
      return;
    }

    const loan = await dbStore.markLoanRepaid(id, userId, notes ? String(notes) : undefined);

    res.status(200).json({
      success: true,
      message: 'Loan marked as fully repaid.',
      data: loan,
    });
  } catch (err) {
    const message = (err as Error).message || 'Operation failed.';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: message });
  }
});
