/**
 * MiniLedger SMS Provider Service
 * Supports Twilio, MSG91, and an explicit development fallback mode.
 */

export interface SmsSendResult {
  success: boolean;
  provider: 'twilio' | 'msg91' | 'mock-dev';
  messageId?: string;
  isMock: boolean;
  warning?: string;
}

/**
 * MiniLedger SMS Provider Service
 * Supports Twilio, MSG91, and an explicit development fallback mode.
 */

export interface SmsSendResult {
  success: boolean;
  provider: 'twilio' | 'msg91' | 'mock-dev';
  messageId?: string;
  isMock: boolean;
  warning?: string;
}

export class SmsService {
  private provider: string;
  private isProduction: boolean;

  constructor() {
    this.provider = (process.env['SMS_PROVIDER'] || 'auto').toLowerCase().trim();
    this.isProduction = process.env['NODE_ENV'] === 'production';
  }

  /**
   * Formats 10-digit Indian number into E.164 (+91XXXXXXXXXX)
   */
  public toE164(phone10: string): string {
    return `+91${phone10}`;
  }

  /**
   * Dispatches OTP to phone number via configured SMS provider.
   */
  public async sendOtp(phone10: string, otp: string): Promise<SmsSendResult> {
    const e164 = this.toE164(phone10);
    const message = `Your MiniLedger verification code is ${otp}. Valid for 5 minutes. Do not share this with anyone.`;

    // 1. Explicit Twilio Request
    if (this.provider === 'twilio') {
      const twilioSid = process.env['TWILIO_ACCOUNT_SID'];
      const twilioAuth = process.env['TWILIO_AUTH_TOKEN'];
      const twilioFrom = process.env['TWILIO_PHONE_NUMBER'] || process.env['TWILIO_SERVICE_SID'];

      if (!twilioSid || !twilioAuth || !twilioFrom) {
        throw new Error(
          'SMS Provider is configured as "twilio", but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER is missing from backend/.env.'
        );
      }

      return await this.dispatchTwilio(twilioSid, twilioAuth, twilioFrom, e164, message);
    }

    // 2. Explicit MSG91 Request
    if (this.provider === 'msg91') {
      const msg91AuthKey = process.env['MSG91_AUTH_KEY'];
      const msg91TemplateId = process.env['MSG91_TEMPLATE_ID'];
      const msg91Sender = process.env['MSG91_SENDER_ID'] || 'MNILDG';

      if (!msg91AuthKey || !msg91TemplateId) {
        throw new Error(
          'SMS Provider is configured as "msg91", but MSG91_AUTH_KEY or MSG91_TEMPLATE_ID is missing from backend/.env.'
        );
      }

      return await this.dispatchMsg91(msg91AuthKey, msg91TemplateId, msg91Sender, phone10, otp, e164);
    }

    // 3. Auto-detection mode: Check if Twilio credentials exist
    const twilioSid = process.env['TWILIO_ACCOUNT_SID'];
    const twilioAuth = process.env['TWILIO_AUTH_TOKEN'];
    const twilioFrom = process.env['TWILIO_PHONE_NUMBER'] || process.env['TWILIO_SERVICE_SID'];

    if (twilioSid && twilioAuth && twilioFrom && (this.provider === 'auto' || !this.provider)) {
      return await this.dispatchTwilio(twilioSid, twilioAuth, twilioFrom, e164, message);
    }

    // 4. Auto-detection mode: Check if MSG91 credentials exist
    const msg91AuthKey = process.env['MSG91_AUTH_KEY'];
    const msg91TemplateId = process.env['MSG91_TEMPLATE_ID'];
    const msg91Sender = process.env['MSG91_SENDER_ID'] || 'MNILDG';

    if (msg91AuthKey && msg91TemplateId && (this.provider === 'auto' || !this.provider)) {
      return await this.dispatchMsg91(msg91AuthKey, msg91TemplateId, msg91Sender, phone10, otp, e164);
    }

    // 5. Fail securely in production if no provider is configured
    if (this.isProduction) {
      throw new Error(
        'SMS Provider unconfigured in production. Real SMS delivery is required. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER, or MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in environment variables.'
      );
    }

    // 6. Explicit Development Mock Mode
    console.warn('\n' + '⚠️ '.repeat(28));
    console.warn('[SMS PROVIDER NOTICE] No active Twilio or MSG91 credentials detected in backend/.env.');
    console.warn(`[SMS PROVIDER NOTICE] Real SMS delivery to ${e164} is UNTESTED pending provider credentials.`);
    console.warn(`[SMS PROVIDER NOTICE] Development Mock OTP [ ${otp} ] generated for local evaluation.`);
    console.warn('⚠️ '.repeat(28) + '\n');

    return {
      success: true,
      provider: 'mock-dev',
      messageId: `mock_${Date.now()}`,
      isMock: true,
      warning:
        'Live SMS provider not configured in backend/.env. Real SMS delivery remains untested. Mock OTP was logged to backend terminal for development evaluation.',
    };
  }

  private async dispatchTwilio(
    twilioSid: string,
    twilioAuth: string,
    twilioFrom: string,
    e164: string,
    message: string
  ): Promise<SmsSendResult> {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', e164);
      params.append('From', twilioFrom);
      params.append('Body', message);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(
          `Twilio dispatch rejected (${response.status}): ${data.message || 'Failed to dispatch SMS'}`
        );
      }

      console.log(`[SMS-TWILIO] Successfully dispatched OTP to ${e164}. SID: ${data.sid}`);
      return {
        success: true,
        provider: 'twilio',
        messageId: data.sid,
        isMock: false,
      };
    } catch (err) {
      console.error('[SMS-TWILIO] Failed to send SMS via Twilio:', (err as Error).message);
      throw new Error(`Twilio SMS delivery failed: ${(err as Error).message}`);
    }
  }

  private async dispatchMsg91(
    msg91AuthKey: string,
    msg91TemplateId: string,
    msg91Sender: string,
    phone10: string,
    otp: string,
    e164: string
  ): Promise<SmsSendResult> {
    try {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(
        msg91TemplateId
      )}&mobile=${encodeURIComponent(`91${phone10}`)}&authkey=${encodeURIComponent(
        msg91AuthKey
      )}&otp=${encodeURIComponent(otp)}&otp_expiry=5`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authkey: msg91AuthKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: msg91TemplateId,
          mobile: `91${phone10}`,
          otp,
          otp_expiry: 5,
          sender: msg91Sender,
        }),
      });

      const data: any = await response.json();
      if (!response.ok || data.type === 'error') {
        throw new Error(`MSG91 dispatch rejected: ${data.message || 'Failed to dispatch OTP'}`);
      }

      console.log(`[SMS-MSG91] Successfully dispatched OTP to ${e164}. RequestId: ${data.request_id || data.message}`);
      return {
        success: true,
        provider: 'msg91',
        messageId: data.request_id || 'msg91_sent',
        isMock: false,
      };
    } catch (err) {
      console.error('[SMS-MSG91] Failed to send OTP via MSG91:', (err as Error).message);
      throw new Error(`MSG91 SMS delivery failed: ${(err as Error).message}`);
    }
  }
}

export const smsService = new SmsService();
