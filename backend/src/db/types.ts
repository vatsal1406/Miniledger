export type LoanStatus = 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID' | 'OVERDUE';

export interface User {
  id: string;
  phone: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtpRecord {
  id: string;
  phone: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

export interface Repayment {
  id: string;
  loanId: string;
  amount: number; // formatted as 2-decimal number in API responses
  repaymentDate: Date;
  notes?: string | null;
  createdAt: Date;
}

export interface Loan {
  id: string;
  userId: string;
  friendName: string;
  amount: number;
  amountRepaid: number;
  remainingBalance: number;
  dueDate: Date;
  status: LoanStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  repayments?: Repayment[];
  receipt?: Receipt | null;
}

export interface Receipt {
  id: string;
  loanId: string;
  url: string;
  publicId?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLoanInput {
  userId: string;
  friendName: string;
  amount: number;
  dueDate: Date;
  notes?: string | null;
  receipt?: {
    url: string;
    publicId?: string | null;
    originalFilename?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  } | null;
}

export interface RecordRepaymentInput {
  loanId: string;
  userId: string;
  amount: number;
  repaymentDate?: Date;
  notes?: string | null;
}

export interface DashboardSummary {
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdueAmount: number;
  activeLoansCount: number;
  overdueLoansCount: number;
  recentLoans: Loan[];
}

export interface ListLoansFilter {
  userId: string;
  search?: string;
  status?: string; // ALL, ACTIVE, OVERDUE, REPAID, PARTIALLY_REPAID
}
