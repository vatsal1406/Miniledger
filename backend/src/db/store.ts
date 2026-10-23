import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { storageService } from '../services/storageService.js';
import type {
  CreateLoanInput,
  DashboardSummary,
  ListLoansFilter,
  Loan,
  LoanStatus,
  OtpRecord,
  Receipt,
  RecordRepaymentInput,
  Repayment,
  User,
} from './types.js';

export class DatabaseStore {
  // Helper for computing loan status given balance, amount repaid, and due date
  public computeLoanStatus(remainingBalance: number, amountRepaid: number, dueDate: Date): LoanStatus {
    const roundRemaining = Math.round(remainingBalance * 100) / 100;
    if (roundRemaining <= 0) {
      return 'REPAID';
    }
    const isPastDue = new Date(dueDate).getTime() < Date.now();
    if (isPastDue) {
      return 'OVERDUE';
    }
    if (amountRepaid > 0) {
      return 'PARTIALLY_REPAID';
    }
    return 'ACTIVE';
  }

  // Helper mapper from Prisma Decimal to numbers for JSON API
  private mapLoan(loan: any): Loan {
    const amount = Number(loan.amount.toString());
    const amountRepaid = Number(loan.amountRepaid.toString());
    const remainingBalance = Number(loan.remainingBalance.toString());
    const status = this.computeLoanStatus(remainingBalance, amountRepaid, loan.dueDate);

    return {
      id: loan.id,
      userId: loan.userId,
      friendName: loan.friendName,
      amount: Math.round(amount * 100) / 100,
      amountRepaid: Math.round(amountRepaid * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
      dueDate: loan.dueDate,
      status,
      notes: loan.notes,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      repayments: loan.repayments ? loan.repayments.map((r: any) => this.mapRepayment(r)) : [],
      receipt: loan.receipt ? this.mapReceipt(loan.receipt) : null,
    };
  }

  private mapRepayment(r: any): Repayment {
    return {
      id: r.id,
      loanId: r.loanId,
      amount: Math.round(Number(r.amount.toString()) * 100) / 100,
      repaymentDate: r.repaymentDate,
      notes: r.notes,
      createdAt: r.createdAt,
    };
  }

  private mapReceipt(r: any): Receipt {
    let url = r.url;
    if (r.publicId && !r.publicId.startsWith('local:') && storageService.isReady()) {
      const signedUrl = storageService.getSignedUrl(r.publicId);
      if (signedUrl) {
        url = signedUrl;
      }
    }

    return {
      id: r.id,
      loanId: r.loanId,
      url,
      publicId: r.publicId,
      originalFilename: r.originalFilename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // --- Users & OTP ---

  async upsertUser(phone: string, name?: string | null): Promise<User> {
    const existing = await prisma.user.findUnique({
      where: { phone },
    });

    if (existing) {
      if (name && name !== existing.name) {
        return await prisma.user.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return existing;
    }

    return await prisma.user.create({
      data: {
        phone,
        name: name || null,
      },
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { phone },
    });
  }

  async saveOtp(phone: string, otp: string, expiresAt: Date): Promise<OtpRecord> {
    return await prisma.otpRecord.create({
      data: {
        phone,
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
      },
    });
  }

  async getLatestOtp(phone: string): Promise<OtpRecord | null> {
    return await prisma.otpRecord.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await prisma.otpRecord.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
      },
    });
  }

  async markOtpVerified(id: string): Promise<void> {
    await prisma.otpRecord.update({
      where: { id },
      data: {
        verified: true,
      },
    });
  }

  // --- Loans ---

  async createLoan(input: CreateLoanInput): Promise<Loan> {
    const amountVal = Math.round(input.amount * 100) / 100;
    if (amountVal <= 0) {
      throw new Error('Loan amount must be a positive number');
    }

    const amountDecimal = new Prisma.Decimal(amountVal.toFixed(2));
    const initialStatus = this.computeLoanStatus(amountVal, 0, input.dueDate);

    const created = await prisma.loan.create({
      data: {
        userId: input.userId,
        friendName: input.friendName.trim(),
        amount: amountDecimal,
        amountRepaid: new Prisma.Decimal(0.0),
        remainingBalance: amountDecimal,
        dueDate: input.dueDate,
        status: initialStatus,
        notes: input.notes?.trim() || null,
        receipt: input.receipt
          ? {
              create: {
                url: input.receipt.url,
                publicId: input.receipt.publicId || null,
                originalFilename: input.receipt.originalFilename || null,
                mimeType: input.receipt.mimeType || null,
                sizeBytes: input.receipt.sizeBytes || null,
              },
            }
          : undefined,
      },
      include: input.receipt ? { receipt: true } : undefined,
    });

    return this.mapLoan(created);
  }

  async getLoanById(id: string, userId: string): Promise<Loan | null> {
    const loan = await prisma.loan.findFirst({
      where: { id, userId },
      include: {
        repayments: {
          orderBy: { repaymentDate: 'desc' },
        },
        receipt: true,
      },
    });

    return loan ? this.mapLoan(loan) : null;
  }

  async listLoans(filter: ListLoansFilter): Promise<Loan[]> {
    const where: Prisma.LoanWhereInput = {
      userId: filter.userId,
    };

    if (filter.search && filter.search.trim()) {
      where.friendName = {
        contains: filter.search.trim(),
        mode: 'insensitive',
      };
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        repayments: {
          orderBy: { repaymentDate: 'desc' },
        },
        receipt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = loans.map((l) => this.mapLoan(l));

    if (filter.status && filter.status !== 'ALL') {
      const targetStatus = filter.status.toUpperCase();
      return mapped.filter((l) => l.status === targetStatus);
    }

    return mapped;
  }

  // --- Repayments (Transactional with Strict Decimal Safety) ---

  async recordRepayment(input: RecordRepaymentInput): Promise<{ loan: Loan; repayment: Repayment }> {
    const repayVal = Math.round(input.amount * 100) / 100;
    if (repayVal <= 0) {
      throw new Error('Repayment amount must be a positive number');
    }

    const repaymentDecimal = new Prisma.Decimal(repayVal.toFixed(2));

    return await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: input.loanId, userId: input.userId },
        include: { receipt: true },
      });

      if (!loan) {
        throw new Error('Loan not found or you are not authorized to repay it.');
      }

      if (loan.status === 'REPAID' || loan.remainingBalance.lte(0)) {
        throw new Error('This loan has already been fully repaid.');
      }

      if (repaymentDecimal.gt(loan.remainingBalance)) {
        throw new Error(
          `Repayment amount (₹${repayVal.toFixed(2)}) exceeds outstanding balance (₹${Number(loan.remainingBalance).toFixed(2)})`
        );
      }

      const newAmountRepaid = loan.amountRepaid.add(repaymentDecimal);
      const newRemainingBalance = loan.remainingBalance.sub(repaymentDecimal);
      const remainingNum = Number(newRemainingBalance.toString());
      const amountRepaidNum = Number(newAmountRepaid.toString());
      const newStatus = this.computeLoanStatus(remainingNum, amountRepaidNum, loan.dueDate);

      const repayment = await tx.repayment.create({
        data: {
          loanId: loan.id,
          amount: repaymentDecimal,
          repaymentDate: input.repaymentDate || new Date(),
          notes: input.notes?.trim() || null,
        },
      });

      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          amountRepaid: newAmountRepaid,
          remainingBalance: newRemainingBalance,
          status: newStatus,
        },
        include: {
          repayments: {
            orderBy: { repaymentDate: 'desc' },
          },
          receipt: true,
        },
      });

      return {
        loan: this.mapLoan(updatedLoan),
        repayment: this.mapRepayment(repayment),
      };
    });
  }

  async markLoanRepaid(id: string, userId: string, notes?: string): Promise<Loan> {
    return await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id, userId },
      });

      if (!loan) {
        throw new Error('Loan not found or unauthorized.');
      }

      if (loan.remainingBalance.lte(0) || loan.status === 'REPAID') {
        const full = await tx.loan.findUniqueOrThrow({
          where: { id },
          include: { repayments: { orderBy: { repaymentDate: 'desc' } }, receipt: true },
        });
        return this.mapLoan(full);
      }

      const remainingToPay = loan.remainingBalance;

      // Create a full repayment record for remaining amount
      await tx.repayment.create({
        data: {
          loanId: loan.id,
          amount: remainingToPay,
          repaymentDate: new Date(),
          notes: notes?.trim() || 'Marked as fully repaid',
        },
      });

      const updatedLoan = await tx.loan.update({
        where: { id },
        data: {
          amountRepaid: loan.amount,
          remainingBalance: new Prisma.Decimal(0.0),
          status: 'REPAID',
        },
        include: {
          repayments: {
            orderBy: { repaymentDate: 'desc' },
          },
          receipt: true,
        },
      });

      return this.mapLoan(updatedLoan);
    });
  }

  // --- Dashboard Summary ---

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const loans = await prisma.loan.findMany({
      where: { userId },
      include: {
        repayments: {
          orderBy: { repaymentDate: 'desc' },
        },
        receipt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedLoans = loans.map((l) => this.mapLoan(l));

    let totalLent = 0;
    let totalRepaid = 0;
    let outstanding = 0;
    let overdueAmount = 0;
    let activeLoansCount = 0;
    let overdueLoansCount = 0;

    for (const loan of mappedLoans) {
      totalLent += loan.amount;
      totalRepaid += loan.amountRepaid;
      outstanding += loan.remainingBalance;

      if (loan.status === 'OVERDUE') {
        overdueAmount += loan.remainingBalance;
        overdueLoansCount += 1;
      } else if (loan.status === 'ACTIVE' || loan.status === 'PARTIALLY_REPAID') {
        activeLoansCount += 1;
      }
    }

    return {
      totalLent: Math.round(totalLent * 100) / 100,
      totalRepaid: Math.round(totalRepaid * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      activeLoansCount,
      overdueLoansCount,
      recentLoans: mappedLoans.slice(0, 5),
    };
  }

  // --- Receipt Metadata & Management ---

  async attachReceipt(
    loanId: string,
    userId: string,
    data: {
      url: string;
      publicId?: string | null;
      originalFilename?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
    }
  ): Promise<Receipt> {
    return await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, userId },
      });

      if (!loan) {
        throw new Error('Loan not found or unauthorized to attach receipt.');
      }

      // Upsert receipt record
      const receipt = await tx.receipt.upsert({
        where: { loanId },
        create: {
          loanId,
          url: data.url,
          publicId: data.publicId || null,
          originalFilename: data.originalFilename || null,
          mimeType: data.mimeType || null,
          sizeBytes: data.sizeBytes || null,
        },
        update: {
          url: data.url,
          publicId: data.publicId || null,
          originalFilename: data.originalFilename || null,
          mimeType: data.mimeType || null,
          sizeBytes: data.sizeBytes || null,
        },
      });

      return this.mapReceipt(receipt);
    });
  }

  async deleteReceipt(loanId: string, userId: string): Promise<Receipt | null> {
    return await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, userId },
      });

      if (!loan) {
        throw new Error('Loan not found or unauthorized.');
      }

      const existing = await tx.receipt.findUnique({
        where: { loanId },
      });

      if (!existing) {
        return null;
      }

      const deleted = await tx.receipt.delete({
        where: { loanId },
      });

      return this.mapReceipt(deleted);
    });
  }
}

export const dbStore = new DatabaseStore();
