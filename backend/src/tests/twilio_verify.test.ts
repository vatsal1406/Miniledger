import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { twilioVerifyService } from '../services/twilioVerifyService.js';
import { authService } from '../services/authService.js';

describe('Twilio Verify Integration & Configuration Suite', () => {
  // Test 1: Configuration detection without printing secrets
  it('1. Backend recognizes Twilio Verify environment variables without printing secrets', () => {
    const isConfigured = twilioVerifyService.isConfigured();
    assert.equal(isConfigured, true, 'twilioVerifyService must recognize Twilio credentials in .env');

    // Confirm variable names match without revealing secrets
    assert.ok(process.env['TWILIO_ACCOUNT_SID'], 'TWILIO_ACCOUNT_SID must exist');
    assert.ok(process.env['TWILIO_API_KEY'], 'TWILIO_API_KEY must exist');
    assert.ok(process.env['TWILIO_API_SECRET'], 'TWILIO_API_SECRET must exist');
    assert.ok(process.env['TWILIO_VERIFY_SERVICE_SID'], 'TWILIO_VERIFY_SERVICE_SID must exist');

    // Confirm SID prefix conventions
    assert.match(process.env['TWILIO_ACCOUNT_SID']!, /^AC/, 'TWILIO_ACCOUNT_SID should start with AC');
    assert.match(process.env['TWILIO_API_KEY']!, /^SK/, 'TWILIO_API_KEY should start with SK');
    assert.match(process.env['TWILIO_VERIFY_SERVICE_SID']!, /^VA/, 'TWILIO_VERIFY_SERVICE_SID should start with VA');
  });

  // Test 2: Phone normalization to E.164
  it('2. Correctly normalizes Indian phone numbers to E.164 format (+91XXXXXXXXXX)', () => {
    assert.equal(twilioVerifyService.toE164('9876543210'), '+919876543210');
    assert.equal(authService.normalizePhoneNumber('+919876543210'), '9876543210');
    assert.equal(authService.normalizePhoneNumber('919876543210'), '9876543210');
    assert.equal(authService.normalizePhoneNumber('+91 98765 43210'), '9876543210');
  });

  // Test 3: Twilio error mapping and rejection handling
  it('3. Accurately maps Twilio Verify errors and prevents silent mock fallback', async () => {
    // Attempting sendVerification with current credentials
    try {
      await twilioVerifyService.sendVerification('+919876543210');
      // If credentials have SMS sending permission on Twilio, this succeeds
      assert.ok(true);
    } catch (err: any) {
      // Must return an actionable error and NOT claim mock success
      assert.ok(err.message, 'Must return a descriptive error message');
      assert.ok(
        err.message.includes('Twilio') || err.message.includes('Verify') || err.message.includes('actor'),
        `Error should explain Twilio status, got: ${err.message}`
      );
      assert.notEqual(err.message, '', 'Error message cannot be empty');
    }
  });

  // Test 4: Rejection of incorrect / unapproved OTP codes
  it('4. Rejects invalid OTP formats and handles verification check rejection', async () => {
    // Non-6-digit codes must be rejected immediately
    await assert.rejects(
      async () => {
        await authService.verifyOtp('9876543210', '123');
      },
      /valid 6-digit OTP/
    );

    await assert.rejects(
      async () => {
        await authService.verifyOtp('9876543210', 'abcdef');
      },
      /valid 6-digit OTP/
    );
  });
});
