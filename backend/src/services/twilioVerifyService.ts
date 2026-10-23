import twilio from 'twilio';

export interface TwilioSendResult {
  success: boolean;
  status: string;
  sid: string;
  to: string;
}

export interface TwilioCheckResult {
  approved: boolean;
  status: string;
  sid: string;
  to: string;
}

export class TwilioVerifyService {
  private accountSid: string | undefined;
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private verifyServiceSid: string | undefined;
  private authToken: string | undefined;

  constructor() {
    this.refreshCredentials();
  }

  public refreshCredentials(): void {
    this.accountSid = process.env['TWILIO_ACCOUNT_SID']?.trim();
    this.apiKey = process.env['TWILIO_API_KEY']?.trim();
    this.apiSecret = process.env['TWILIO_API_SECRET']?.trim();
    this.verifyServiceSid = process.env['TWILIO_VERIFY_SERVICE_SID']?.trim();
    this.authToken = process.env['TWILIO_AUTH_TOKEN']?.trim();
  }

  /**
   * Checks whether all required Twilio Verify configuration is present in environment variables.
   * Matches exactly:
   * - TWILIO_ACCOUNT_SID
   * - TWILIO_API_KEY + TWILIO_API_SECRET (or TWILIO_AUTH_TOKEN)
   * - TWILIO_VERIFY_SERVICE_SID
   */
  public isConfigured(): boolean {
    this.refreshCredentials();
    const hasAuth = (this.apiKey && this.apiSecret) || !!this.authToken;
    return !!(this.accountSid && this.verifyServiceSid && hasAuth);
  }

  /**
   * Formats a 10-digit Indian number into E.164 (+91XXXXXXXXXX).
   */
  public toE164(phone10: string): string {
    return `+91${phone10}`;
  }

  private getClient(): twilio.Twilio {
    this.refreshCredentials();

    if (!this.accountSid || !this.verifyServiceSid) {
      throw new Error(
        'Twilio Verify configuration error: TWILIO_ACCOUNT_SID and TWILIO_VERIFY_SERVICE_SID are required in backend/.env.'
      );
    }

    if (this.apiKey && this.apiSecret) {
      return twilio(this.apiKey, this.apiSecret, { accountSid: this.accountSid });
    }

    if (this.authToken) {
      return twilio(this.accountSid, this.authToken);
    }

    throw new Error(
      'Twilio Verify configuration error: Either (TWILIO_API_KEY and TWILIO_API_SECRET) or TWILIO_AUTH_TOKEN is required.'
    );
  }

  /**
   * Dispatches OTP through Twilio Verify's Verification API using channel 'sms'.
   * Phone number must be normalized E.164 format.
   */
  public async sendVerification(e164Phone: string): Promise<TwilioSendResult> {
    const client = this.getClient();
    const serviceSid = this.verifyServiceSid!;

    try {
      const verification = await client.verify.v2
        .services(serviceSid)
        .verifications.create({
          to: e164Phone,
          channel: 'sms',
        });

      return {
        success: verification.status === 'pending' || verification.status === 'approved',
        status: verification.status,
        sid: verification.sid,
        to: verification.to,
      };
    } catch (err: any) {
      this.handleTwilioError('Send OTP', err);
    }
  }

  /**
   * Checks submitted OTP against Twilio Verify's VerificationCheck API.
   * Accepts login only when Twilio returns status === 'approved'.
   */
  public async checkVerification(e164Phone: string, code: string): Promise<TwilioCheckResult> {
    const client = this.getClient();
    const serviceSid = this.verifyServiceSid!;

    try {
      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: e164Phone,
          code: code.trim(),
        });

      const isApproved = check.status === 'approved';

      if (!isApproved) {
        throw new Error('Incorrect OTP. The verification code entered is invalid or has expired.');
      }

      return {
        approved: true,
        status: check.status,
        sid: check.sid,
        to: check.to,
      };
    } catch (err: any) {
      // Re-throw if already handled/formatted error message
      if (err.message && err.message.startsWith('Incorrect OTP')) {
        throw err;
      }
      this.handleTwilioError('Check OTP', err);
    }
  }

  /**
   * Sanitizes Twilio error codes and maps them to clear, actionable user messages
   * without ever exposing API secrets, tokens, or credentials in production.
   */
  private handleTwilioError(action: string, err: any): never {
    const code = err.code || err.status;
    let userMessage = `Twilio Verify ${action} failed.`;

    if (code === 8001 || err.status === 401) {
      userMessage =
        'Twilio authentication rejected (Error 8001: Actor assertions missing). Please ensure your Twilio API Key has "Verify" permissions in the Twilio Console (or use a Standard API Key / Auth Token).';
    } else if (code === 60200) {
      userMessage = 'Invalid phone number format provided for SMS delivery.';
    } else if (code === 60202) {
      userMessage = 'Maximum verification check attempts reached for this code. Please request a new OTP.';
    } else if (code === 60203) {
      userMessage = 'Maximum OTP send attempts reached for this number. Please wait before requesting another code.';
    } else if (code === 20404) {
      userMessage = 'Verification session expired or not found. Please request a new OTP.';
    } else if (code === 21608) {
      userMessage =
        'Twilio Trial Account Restriction: The destination phone number is not verified. In trial mode, you must verify the recipient number in Twilio Console > Phone Numbers > Verified Caller IDs.';
    } else if (code === 21211 || code === 21614) {
      userMessage = 'Invalid or unroutable phone number for SMS delivery.';
    } else if (err.message) {
      userMessage = err.message;
    }

    const wrappedError = new Error(userMessage);
    (wrappedError as any).twilioCode = code;
    (wrappedError as any).httpStatus = err.status || 502;
    throw wrappedError;
  }
}

export const twilioVerifyService = new TwilioVerifyService();
