import crypto from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { dbStore } from '../db/store.js';
import type { User } from '../db/types.js';
import { smsService } from './smsService.js';
import { twilioVerifyService } from './twilioVerifyService.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const MAX_OTP_ATTEMPTS = 3;

export interface TokenPayload {
  userId: string;
  phone: string;
}

export class AuthService {
  private getJwtSecret(): string {
    const secret = process.env['JWT_SECRET'];
    if (!secret || secret.trim().length === 0) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is strictly required in production.');
      }
      return 'dev-fallback-secret-for-local-testing-only-replace-in-env-32-chars';
    }
    return secret;
  }

  /**
   * Validates and normalizes Indian phone numbers.
   * Accepts: +91 9876543210, 919876543210, 9876543210
   * Must be 10 digits starting with 6, 7, 8, or 9.
   */
  public normalizePhoneNumber(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new Error('Phone number is required');
    }

    const cleaned = input.replace(/[\s\-\(\)]/g, '');
    const match = cleaned.match(/^(?:\+91|91)?([6-9]\d{9})$/);
    if (!match || !match[1]) {
      throw new Error('Please enter a valid 10-digit Indian phone number (starting with 6, 7, 8, or 9)');
    }

    return match[1];
  }

  /**
   * Dispatches OTP via Twilio Verify if configured, or development mock mode if explicitly configured.
   * Enforces 30-second cooldown and 5-minute expiry.
   */
  public async sendOtp(rawPhone: string): Promise<{
    cooldownSeconds: number;
    message: string;
    isMockDelivery: boolean;
    provider: string;
  }> {
    const phone = this.normalizePhoneNumber(rawPhone);
    const e164 = `+91${phone}`;

    // Check resend cooldown from DB
    const latest = await dbStore.getLatestOtp(phone);
    const now = Date.now();
    if (latest && !latest.verified) {
      const elapsed = now - latest.createdAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new Error(`Please wait ${remainingSeconds}s before requesting a new OTP`);
      }
    }

    const isMockExplicit = (process.env['SMS_PROVIDER'] || '').toLowerCase().trim() === 'mock';
    const isTwilioConfigured = twilioVerifyService.isConfigured();

    // 1. Twilio Verify Mode (Real SMS)
    if (isTwilioConfigured && !isMockExplicit) {
      // Call Twilio Verify API with channel 'sms'
      await twilioVerifyService.sendVerification(e164);

      // Record tracking entry in PostgreSQL (do not generate local OTP)
      const expiresAt = new Date(now + OTP_EXPIRY_MS);
      await dbStore.saveOtp(phone, 'TWILIO_VERIFY', expiresAt);

      return {
        cooldownSeconds: 30,
        message: `OTP sent successfully to +91${phone} via Twilio Verify SMS.`,
        isMockDelivery: false,
        provider: 'twilio-verify',
      };
    }

    // 2. Prevent unconfigured delivery in production
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'SMS provider unconfigured in production. Real SMS delivery is required. Please configure TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_VERIFY_SERVICE_SID.'
      );
    }

    // 3. Development Mock Mode (Fallback / Testing)
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(now + OTP_EXPIRY_MS);
    await dbStore.saveOtp(phone, otp, expiresAt);

    console.warn('\n' + '⚠️ '.repeat(28));
    console.warn('[DEVELOPMENT MOCK MODE] Real SMS provider bypassed or in mock setting.');
    console.warn(`[DEVELOPMENT MOCK MODE] Mock OTP [ ${otp} ] generated for +91${phone}.`);
    console.warn('⚠️ '.repeat(28) + '\n');

    return {
      cooldownSeconds: 30,
      message: 'Development Mock Mode: Mock OTP logged to backend terminal. (Live SMS delivery untested)',
      isMockDelivery: true,
      provider: 'mock-dev',
    };
  }

  /**
   * Verifies OTP:
   * - In Twilio Verify mode: verifies through Twilio's VerificationCheck API.
   * - In Mock mode: verifies against persistent DB record.
   * Retrieves or creates user in PostgreSQL and issues signed JWT.
   */
  public async verifyOtp(
    rawPhone: string,
    otp: string,
    name?: string
  ): Promise<{ token: string; user: User }> {
    const phone = this.normalizePhoneNumber(rawPhone);
    const e164 = `+91${phone}`;

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw new Error('Please enter a valid 6-digit OTP');
    }

    const trimmedOtp = otp.trim();
    const isMockExplicit = (process.env['SMS_PROVIDER'] || '').toLowerCase().trim() === 'mock';
    const isTwilioConfigured = twilioVerifyService.isConfigured();

    // 1. Twilio Verify Mode
    if (isTwilioConfigured && !isMockExplicit) {
      // Call Twilio Verify VerificationCheck API
      await twilioVerifyService.checkVerification(e164, trimmedOtp);

      // Mark latest tracking OTP record verified in DB if present
      const latest = await dbStore.getLatestOtp(phone);
      if (latest) {
        await dbStore.markOtpVerified(latest.id).catch(() => {});
      }

      // Persist or retrieve user in PostgreSQL
      const user = await dbStore.upsertUser(phone, name);

      // Issue signed JWT (valid for 30 days)
      const token = this.generateToken(user.id, user.phone);

      return { token, user };
    }

    // 2. Development Mock Mode verification against local PostgreSQL record
    const record = await dbStore.getLatestOtp(phone);

    if (!record) {
      throw new Error('No OTP request found for this phone number. Please request a new OTP.');
    }

    if (record.verified) {
      throw new Error('This OTP has already been verified. Please request a new OTP.');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new Error('This OTP has expired. Please request a new OTP.');
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    if (record.otp !== trimmedOtp) {
      await dbStore.incrementOtpAttempts(record.id);
      const remaining = MAX_OTP_ATTEMPTS - (record.attempts + 1);
      if (remaining <= 0) {
        throw new Error('Incorrect OTP. Maximum attempts reached. Please request a new OTP.');
      }
      throw new Error(`Incorrect OTP. ${remaining} attempt(s) remaining.`);
    }

    // Mark verified in PostgreSQL
    await dbStore.markOtpVerified(record.id);

    // Persist / update user in PostgreSQL
    const user = await dbStore.upsertUser(phone, name);

    // Sign JWT (valid for 30 days)
    const token = this.generateToken(user.id, user.phone);

    return { token, user };
  }

  /**
   * Generates a signed token with standard jsonwebtoken library.
   * Signed with HS256 and standard expiresIn claim.
   */
  public generateToken(userId: string, phone: string, customExpiresIn: string = '30d'): string {
    const secret = this.getJwtSecret();
    return jwt.sign(
      {
        userId,
        phone,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: customExpiresIn as any,
      }
    );
  }

  /**
   * Verifies and decodes a signed JWT token.
   * Verifies signature and expiration on every protected request.
   */
  public verifyToken(token: string): TokenPayload {
    if (!token || typeof token !== 'string') {
      throw new Error('Missing authentication token');
    }

    const secret = this.getJwtSecret();

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as JwtPayload & TokenPayload;

      if (!decoded.userId || !decoded.phone) {
        throw new Error('Invalid token payload: missing user identification');
      }

      return {
        userId: decoded.userId,
        phone: decoded.phone,
      };
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Your session has expired. Please log in again.');
      }
      throw new Error('Invalid or malformed authentication token.');
    }
  }
}

export const authService = new AuthService();
