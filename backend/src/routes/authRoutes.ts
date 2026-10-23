import { Router, type Request, type Response } from 'express';
import { dbStore } from '../db/store.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authService } from '../services/authService.js';

export const authRouter = Router();

authRouter.post('/send-otp', async (req: Request, res: Response) => {
  const rawPhone = req.body?.phone || req.body?.phoneNumber;
  console.log(`[AUTH] Incoming POST /api/auth/send-otp for phone: "${rawPhone}"`);

  try {
    if (!rawPhone) {
      console.warn('[AUTH] Missing phone number in request body');
      res.status(400).json({ success: false, error: 'Phone number is required.' });
      return;
    }

    const result = await authService.sendOtp(String(rawPhone));
    console.log(`[AUTH] Successfully generated OTP for +91 ${rawPhone} (Provider: ${result.provider}, isMock: ${result.isMockDelivery})`);
    res.status(200).json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
      isMockDelivery: result.isMockDelivery,
      provider: result.provider,
    });
  } catch (err) {
    const message = (err as Error).message || 'Failed to send OTP';
    console.warn(`[AUTH] Failed to send OTP for "${rawPhone}": ${message}`);
    const status =
      (err as any).httpStatus ||
      (message.includes('wait') ? 429 : message.includes('failed') || message.includes('rejected') ? 502 : 400);
    res.status(status).json({ success: false, error: message });
  }
});

authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  const { phone, phoneNumber, otp, code, name } = req.body || {};
  const targetPhone = phone || phoneNumber;
  const targetOtp = otp || code;
  console.log(`[AUTH] Incoming POST /api/auth/verify-otp for phone: "${targetPhone}"`);

  try {
    if (!targetPhone || !targetOtp) {
      res.status(400).json({ success: false, error: 'Phone and 6-digit OTP are required.' });
      return;
    }

    const result = await authService.verifyOtp(String(targetPhone), String(targetOtp), name ? String(name) : undefined);
    console.log(`[AUTH] OTP verified successfully for User ID: ${result.user.id} (+91 ${result.user.phone})`);
    res.status(200).json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        name: result.user.name,
        createdAt: result.user.createdAt,
      },
    });
  } catch (err) {
    const message = (err as Error).message || 'Verification failed.';
    console.warn(`[AUTH] Verification failed for phone "${phone}": ${message}`);
    const status = (err as any).httpStatus || 400;
    res.status(status).json({ success: false, error: message });
  }
});

authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await dbStore.getUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
