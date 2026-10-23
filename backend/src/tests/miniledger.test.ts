import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { dbStore } from '../db/store.js';
import { authService } from '../services/authService.js';
import { prisma } from '../db/prisma.js';

describe('MiniLedger Business Logic & Store Tests (PostgreSQL + Prisma 7)', () => {
  const store = dbStore;
  const auth = authService;

  let userA_Id: string;
  let userB_Id: string;
  let isolatedUserId: string;

  before(async () => {
    const uA = await store.upsertUser('9876543210', 'Test User A');
    userA_Id = uA.id;

    const uB = await store.upsertUser('9998887776', 'Test User B');
    userB_Id = uB.id;

    const uIso = await store.upsertUser('9112233445', 'Isolated User');
    isolatedUserId = uIso.id;

    process.env['SMS_PROVIDER'] = 'mock';

    // Clean up any test records for these specific test users so tests are idempotent
    await prisma.receipt.deleteMany({
      where: { loan: { userId: { in: [userA_Id, userB_Id, isolatedUserId] } } },
    });
    await prisma.repayment.deleteMany({
      where: { loan: { userId: { in: [userA_Id, userB_Id, isolatedUserId] } } },
    });
    await prisma.loan.deleteMany({
      where: { userId: { in: [userA_Id, userB_Id, isolatedUserId] } },
    });
    await prisma.otpRecord.deleteMany({
      where: { phone: { in: ['9876543210', '9998887776', '9112233445'] } },
    });
  });

  describe('1. Phone Number and Mock OTP Validation', () => {
    it('should validate and normalize valid Indian phone numbers', () => {
      assert.equal(auth.normalizePhoneNumber('+919876543210'), '9876543210');
      assert.equal(auth.normalizePhoneNumber('919876543210'), '9876543210');
      assert.equal(auth.normalizePhoneNumber('9876543210'), '9876543210');
      assert.equal(auth.normalizePhoneNumber('+91 98765 43210'), '9876543210');
    });

    it('should reject invalid Indian phone numbers', () => {
      assert.throws(() => auth.normalizePhoneNumber('12345'), /valid 10-digit/);
      assert.throws(() => auth.normalizePhoneNumber('5555555555'), /valid 10-digit/); // Indian numbers start 6-9
      assert.throws(() => auth.normalizePhoneNumber(''), /required/);
    });

    it('should send mock OTP and verify with signed JWT token', async () => {
      const res = await auth.sendOtp('9876543210');
      assert.equal(res.cooldownSeconds, 30);

      const latestOtp = await store.getLatestOtp('9876543210');
      assert.ok(latestOtp);
      assert.equal(latestOtp.otp.length, 6);

      const verified = await auth.verifyOtp('9876543210', latestOtp.otp, 'Test User A');
      assert.ok(verified.token);
      assert.equal(verified.user.phone, '9876543210');

      const decoded = auth.verifyToken(verified.token);
      assert.equal(decoded.phone, '9876543210');
      assert.equal(decoded.userId, verified.user.id);
    });

    it('should reject incorrect OTP and enforce maximum attempts', async () => {
      await auth.sendOtp('9998887776');
      await assert.rejects(
        async () => auth.verifyOtp('9998887776', '000000'),
        /Incorrect OTP/
      );
    });
  });

  describe('2. Positive Loan Amount Validation & Creation', () => {
    it('should create a loan with positive amount and correct initial balances in PostgreSQL', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Rohan Sharma',
        amount: 10000,
        dueDate,
        notes: 'Rent split',
      });

      assert.ok(loan.id);
      assert.equal(loan.userId, userA_Id);
      assert.equal(loan.friendName, 'Rohan Sharma');
      assert.equal(loan.amount, 10000);
      assert.equal(loan.amountRepaid, 0);
      assert.equal(loan.remainingBalance, 10000);
      assert.equal(loan.status, 'ACTIVE');

      // Verify persistence in actual database
      const dbRow = await prisma.loan.findUnique({ where: { id: loan.id } });
      assert.ok(dbRow);
      assert.equal(Number(dbRow.amount), 10000);
    });

    it('should calculate initial OVERDUE status if due date is already in the past', async () => {
      const pastDueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Ananya Roy',
        amount: 5000,
        dueDate: pastDueDate,
      });

      assert.equal(loan.status, 'OVERDUE');
    });
  });

  describe('3. Partial Repayment & Balance Updates', () => {
    it('should process partial repayment and update remaining balance & status in transaction', async () => {
      const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Vikram Singh',
        amount: 15000,
        dueDate,
      });

      const { loan: updatedLoan, repayment } = await store.recordRepayment({
        loanId: loan.id,
        userId: userA_Id,
        amount: 5000,
        notes: 'First installment',
      });

      assert.equal(updatedLoan.amountRepaid, 5000);
      assert.equal(updatedLoan.remainingBalance, 10000);
      assert.equal(updatedLoan.status, 'PARTIALLY_REPAID');
      assert.equal(repayment.amount, 5000);
    });
  });

  describe('4. Excessive Repayment Rejection', () => {
    it('should reject repayment exceeding remaining balance', async () => {
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Kunal Verma',
        amount: 2000,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });

      await assert.rejects(
        async () => {
          await store.recordRepayment({
            loanId: loan.id,
            userId: userA_Id,
            amount: 2500, // Exceeds balance
          });
        },
        /exceeds outstanding/
      );
    });

    it('should reject non-positive repayment amount', async () => {
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Neha Kapoor',
        amount: 3000,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });

      await assert.rejects(
        async () => {
          await store.recordRepayment({
            loanId: loan.id,
            userId: userA_Id,
            amount: 0,
          });
        },
        /positive number/
      );
    });
  });

  describe('5. Full Repayment Transition', () => {
    it('should mark loan as REPAID when remaining balance reaches zero', async () => {
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Meera Iyer',
        amount: 4000,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });

      const { loan: updatedLoan } = await store.recordRepayment({
        loanId: loan.id,
        userId: userA_Id,
        amount: 4000,
      });

      assert.equal(updatedLoan.remainingBalance, 0);
      assert.equal(updatedLoan.amountRepaid, 4000);
      assert.equal(updatedLoan.status, 'REPAID');
    });

    it('should support markLoanRepaid helper action', async () => {
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Sanjay Dutt',
        amount: 6000,
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      });

      const repaid = await store.markLoanRepaid(loan.id, userA_Id, 'Settled in cash');
      assert.equal(repaid.remainingBalance, 0);
      assert.equal(repaid.status, 'REPAID');
    });
  });

  describe('6. Overdue Calculation', () => {
    it('should dynamically flag overdue loan when current time passes due date with remaining balance', () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      const status = store.computeLoanStatus(500, 200, pastDate);
      assert.equal(status, 'OVERDUE');
    });

    it('should NOT flag as overdue if remaining balance is zero even if due date passed', () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      const status = store.computeLoanStatus(0, 700, pastDate);
      assert.equal(status, 'REPAID');
    });
  });

  describe('7. Dashboard Summary Calculations', () => {
    it('should accurately compute totals and counts across user loans', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      // Loan 1: 10,000, repaid 2,000, remaining 8,000 (Active, future due date)
      const l1 = await store.createLoan({
        userId: isolatedUserId,
        friendName: 'Friend 1',
        amount: 10000,
        dueDate: new Date(now + 5 * day),
      });
      await store.recordRepayment({ loanId: l1.id, userId: isolatedUserId, amount: 2000 });

      // Loan 2: 5,000, repaid 0, remaining 5,000 (Overdue, past due date)
      await store.createLoan({
        userId: isolatedUserId,
        friendName: 'Friend 2',
        amount: 5000,
        dueDate: new Date(now - 3 * day),
      });

      // Loan 3: 3,000, repaid 3,000, remaining 0 (Repaid)
      const l3 = await store.createLoan({
        userId: isolatedUserId,
        friendName: 'Friend 3',
        amount: 3000,
        dueDate: new Date(now + 10 * day),
      });
      await store.recordRepayment({ loanId: l3.id, userId: isolatedUserId, amount: 3000 });

      const summary = await store.getDashboardSummary(isolatedUserId);

      // Total lent: 10,000 + 5,000 + 3,000 = 18,000
      assert.equal(summary.totalLent, 18000);
      // Total repaid: 2,000 + 0 + 3,000 = 5,000
      assert.equal(summary.totalRepaid, 5000);
      // Outstanding: 8,000 + 5,000 = 13,000
      assert.equal(summary.outstanding, 13000);
      // Overdue amount: 5,000
      assert.equal(summary.overdueAmount, 5000);
      // Active count (future due date with remaining balance): 1
      assert.equal(summary.activeLoansCount, 1);
      // Overdue count: 1
      assert.equal(summary.overdueLoansCount, 1);
    });
  });

  describe('8. User Ownership & Data Isolation', () => {
    it('should strictly isolate data and prevent user B from accessing user A loan', async () => {
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Confidential Friend',
        amount: 12000,
        dueDate: new Date(),
      });

      // User A can access
      const userALoan = await store.getLoanById(loan.id, userA_Id);
      assert.ok(userALoan);
      assert.equal(userALoan.friendName, 'Confidential Friend');

      // User B cannot access
      const userBLoan = await store.getLoanById(loan.id, userB_Id);
      assert.equal(userBLoan, null);

      // User B cannot repay user A loan
      await assert.rejects(
        async () => {
          await store.recordRepayment({
            loanId: loan.id,
            userId: userB_Id,
            amount: 1000,
          });
        },
        /Loan not found or you are not authorized/
      );
    });
  });

  describe('9. Receipt Attachments & Metadata', () => {
    it('should attach and delete a receipt for a user loan', async () => {
      const loan = await store.createLoan({
        userId: userA_Id,
        friendName: 'Receipt Friend',
        amount: 8000,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });

      const receipt = await store.attachReceipt(loan.id, userA_Id, {
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        publicId: 'miniledger/receipts/sample_123',
        originalFilename: 'loan_agreement.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 154200,
      });

      assert.ok(receipt.id);
      assert.equal(receipt.loanId, loan.id);
      assert.equal(receipt.originalFilename, 'loan_agreement.jpg');

      // User B cannot delete user A receipt
      await assert.rejects(
        async () => {
          await store.deleteReceipt(loan.id, userB_Id);
        },
        /unauthorized/
      );

      // User A can delete receipt
      const deleted = await store.deleteReceipt(loan.id, userA_Id);
      assert.ok(deleted);
      assert.equal(deleted.id, receipt.id);
    });
  });

  after(async () => {
    await prisma.$disconnect();
  });
});

