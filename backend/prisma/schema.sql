-- MiniLedger PostgreSQL Database Schema

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_records (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_records(phone);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_name VARCHAR(150) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  amount_repaid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_repaid >= 0),
  remaining_balance NUMERIC(12, 2) NOT NULL CHECK (remaining_balance >= 0),
  due_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_due ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

CREATE TABLE IF NOT EXISTS repayments (
  id VARCHAR(64) PRIMARY KEY,
  loan_id VARCHAR(64) NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  repayment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repayments_loan ON repayments(loan_id);
