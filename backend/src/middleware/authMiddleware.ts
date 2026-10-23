import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/authService.js';

export interface AuthenticatedUser {
  id: string;
  phone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a Bearer token.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = authService.verifyToken(token);
    req.user = {
      id: payload.userId,
      phone: payload.phone,
    };
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: (err as Error).message || 'Invalid or expired token.',
    });
  }
}
