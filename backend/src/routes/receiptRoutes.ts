import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { dbStore } from '../db/store.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { storageService } from '../services/storageService.js';
import { authService } from '../services/authService.js';
import { prisma } from '../db/prisma.js';

export const receiptRouter = Router();

// Track staged receipts pending loan association: filename -> { userId, expiresAt }
const stagedReceiptsByUser = new Map<string, { userId: string; expiresAt: number }>();

// Periodic cleanup of expired staging entries (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [filename, item] of stagedReceiptsByUser.entries()) {
    if (item.expiresAt < now) {
      stagedReceiptsByUser.delete(filename);
    }
  }
}, 10 * 60 * 1000).unref();

// Configure multer memory storage (5MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: JPG, PNG, WebP, HEIC`));
    }
  },
});

// POST /api/receipts/stage - Stage an uploaded receipt before loan creation
receiptRouter.post(
  '/receipts/stage',
  authMiddleware,
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file uploaded. Key must be "receipt".' });
        return;
      }

      const uploadResult = await storageService.uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Extract filename if local storage
      if (uploadResult.publicId?.startsWith('local:')) {
        const localFilename = uploadResult.publicId.replace('local:', '');
        stagedReceiptsByUser.set(localFilename, {
          userId,
          expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour TTL
        });
      }

      res.status(200).json({
        success: true,
        message: 'Receipt uploaded to staging successfully.',
        data: {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: uploadResult.sizeBytes,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, error: (err as Error).message || 'Failed to stage receipt' });
    }
  }
);

// POST /api/loans/:id/receipt - Upload & attach receipt photo to an existing loan
receiptRouter.post(
  '/loans/:id/receipt',
  authMiddleware,
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const rawId = req.params['id'];
      if (!rawId) {
        res.status(400).json({ success: false, error: 'Loan ID parameter is required.' });
        return;
      }
      const loanId = String(rawId);

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file uploaded. Key must be "receipt".' });
        return;
      }

      // Check loan existence & ownership
      const loan = await dbStore.getLoanById(loanId, userId);
      if (!loan) {
        res.status(404).json({ success: false, error: 'Loan not found or unauthorized.' });
        return;
      }

      // If an existing receipt exists, delete old file to prevent orphaned storage
      if (loan.receipt?.publicId) {
        await storageService.deleteReceipt(loan.receipt.publicId).catch(() => {});
      }

      // Upload to storage provider
      const uploadResult = await storageService.uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Save metadata in PostgreSQL; rollback file if DB write fails
      let receipt;
      try {
        receipt = await dbStore.attachReceipt(loanId, userId, {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: uploadResult.sizeBytes,
        });
      } catch (dbErr) {
        if (uploadResult.publicId) {
          await storageService.deleteReceipt(uploadResult.publicId).catch(() => {});
        }
        throw dbErr;
      }

      res.status(200).json({
        success: true,
        message: 'Receipt uploaded and attached successfully.',
        data: receipt,
      });
    } catch (err) {
      const message = (err as Error).message || 'Failed to upload receipt.';
      res.status(400).json({ success: false, error: message });
    }
  }
);

// DELETE /api/loans/:id/receipt - Remove receipt from a loan
receiptRouter.delete('/loans/:id/receipt', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawId = req.params['id'];
    if (!rawId) {
      res.status(400).json({ success: false, error: 'Loan ID parameter is required.' });
      return;
    }
    const loanId = String(rawId);

    const loan = await dbStore.getLoanById(loanId, userId);
    if (!loan) {
      res.status(404).json({ success: false, error: 'Loan not found or unauthorized.' });
      return;
    }

    if (loan.receipt?.publicId) {
      await storageService.deleteReceipt(loan.receipt.publicId).catch(() => {});
    }

    await dbStore.deleteReceipt(loanId, userId);

    res.status(200).json({
      success: true,
      message: 'Receipt removed successfully.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/receipts/file/:filename - Securely serve local dev receipt files with user ownership verification
receiptRouter.get('/receipts/file/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!filename || typeof filename !== 'string') {
    res.status(400).send('Invalid filename');
    return;
  }

  // Extract auth token from Authorization header or query parameter (for <Image> tags)
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : typeof req.query['token'] === 'string'
    ? req.query['token'].trim()
    : null;

  if (!token) {
    res.status(401).send('Authentication required to view receipt proof.');
    return;
  }

  let user;
  try {
    user = authService.verifyToken(token);
  } catch {
    res.status(401).send('Invalid or expired authentication token.');
    return;
  }

  // Prevent path traversal
  const safeFilename = path.basename(filename);

  // Enforce ownership: the requesting user must own the loan associated with this receipt,
  // or must be the owner of a staged receipt pending loan creation
  const isStagedOwner = stagedReceiptsByUser.get(safeFilename)?.userId === user.userId;
  const receipt = await prisma.receipt.findFirst({
    where: {
      publicId: `local:${safeFilename}`,
      loan: { userId: user.userId },
    },
  });

  if (!receipt && !isStagedOwner) {
    res.status(404).send('Receipt not found or unauthorized.');
    return;
  }

  const filePath = path.resolve(process.cwd(), 'uploads', 'receipts', safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Receipt file not found on disk.');
    return;
  }

  res.sendFile(filePath);
});
