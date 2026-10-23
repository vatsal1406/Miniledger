# MiniLedger — Personal Lending & Debt Tracker

MiniLedger is a full-stack, mobile-first fintech application designed to track personal loans lent to friends, manage partial and full repayments, and monitor outstanding debts. Built with a modern, high-contrast financial aesthetic, MiniLedger replaces disorganized spreadsheets, text messages, and forgotten IOUs with automated overdue tracking, precise decimal calculations, transaction histories, and digital receipt proof.

---

## 📑 Table of Contents

1. [Overview & Features](#-overview--features)
2. [Technology Stack](#-technology-stack)
3. [Repository Structure](#-repository-structure)
4. [Prerequisites](#-prerequisites)
5. [Environment Configuration](#-environment-configuration)
6. [Database Setup (Neon PostgreSQL & Prisma)](#-database-setup-neon-postgresql--prisma)
7. [Running the Application](#-running-the-application)
8. [Connecting a Physical Device (Expo Go)](#-connecting-a-physical-device-expo-go)
9. [Authentication & OTP Workflow](#-authentication--otp-workflow)
10. [Receipt Photo Storage & Upload Architecture](#-receipt-photo-storage--upload-architecture)
11. [API Endpoints Reference](#-api-endpoints-reference)
12. [Testing & Verification](#-testing--verification)
13. [Security Architecture](#-security-architecture)
14. [Troubleshooting Guide](#-troubleshooting-guide)
15. [Roadmap & Future Improvements](#-roadmap--future-improvements)

---

## 🌟 Overview & Features

### 1. Financial Dashboard
- **Aggregate Summary Cards**: Displays Total Amount Lent, Total Amount Repaid, Outstanding Balance, Overdue Amount, Active Loans Count, and Overdue Loans Count.
- **Dynamic Overdue Tracking**: Automatically flags debts as `OVERDUE` in high-contrast red when current time passes the scheduled due date with an outstanding balance.
- **Indian Rupee Formatting**: Formatted via `Intl.NumberFormat('en-IN')` with proper rupee symbol (`₹`) and comma grouping (e.g., `₹1,50,000`).
- **Recent Loans Feed**: Quick-glance list of recent loans with repayment progress bars and status badges.
- **Pull-to-Refresh**: Real-time synchronization across queries using TanStack React Query.

### 2. Loan Management
- **Search & Filter**: Search loans by friend's name client/server-side; filter by status chips (**All**, **Active**, **Overdue**, **Repaid**).
- **Add Loan with Custom Calendar**:
  - Enter friend's name, loan amount in INR, expected due date, optional purpose/notes, and optional receipt photo.
  - Quick amount chips (₹1,000, ₹2,500, ₹5,000, ₹10,000, ₹20,000).
  - Custom full-month interactive calendar modal with month/year navigation, quick jumps (Today, +1W, +2W, +1M, +3M), and weekday headers.
  - Fast 1-tap shortcut preset chips directly on the form (+1 Week, +2 Weeks, +1 Month, +3 Months).
- **Detailed Loan Breakdown**:
  - Full financial metrics: Original Amount, Amount Repaid, Remaining Balance, and Percentage Settled bar.
  - Complete chronological repayment history with timestamps and optional notes.
- **Strict Repayment Processing**:
  - **Partial Repayments**: Record installments with date and notes; updates balances transactionally.
  - **Excessive Repayment Protection**: Rejects any repayment amount greater than the remaining balance.
  - **Zero/Negative Repayment Protection**: Rejects zero or negative amounts.
  - **One-Tap Mark as Repaid**: Settles outstanding balances in full with confirmation.

### 3. Proof of Transfer / Receipt Attachment
- Attach transfer receipts, UPI payment screenshots, or bills during loan creation or anytime via the loan details modal.
- Native photo picker using `expo-image-picker` and streaming binary upload via `expo-file-system`.
- In-app thumbnail preview and full-screen proof viewer with pinch-to-zoom.
- Safe deletion with storage cleanup and database rollback.

### 4. Authentication & Security
- 10-digit Indian mobile number validation (`+91` / `[6-9]\d{9}`).
- SMS OTP delivery via **Twilio Verify API** or built-in **Development Mock Mode**.
- 30-second resend cooldown timer and 3-attempt brute-force rate limit.
- Stateless, cryptographically signed JSON Web Tokens (`HS256`, 30-day validity).
- Strict multi-tenant data isolation: all queries filter by authenticated `userId`.

---

## 🛠️ Technology Stack

### Mobile Client (`/mobile`)
| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | React Native 0.88 + Expo SDK 58 | Native runtime powered by React 19 |
| **Routing** | Expo Router 58 | File-based navigation with native tab bars |
| **State & Cache** | TanStack React Query v5 | Server-state caching, background revalidation, optimistic updates |
| **File System** | `expo-file-system` | WinterCG-compliant binary file streaming for multipart uploads |
| **Media Picker** | `expo-image-picker` | Native image selection from device gallery |
| **Images** | `expo-image` | High-performance image rendering with auth token headers |
| **Language** | TypeScript 5.8 / 6.0 | Strict type checks (`tsc --noEmit`) |
| **Styling** | Vanilla React Native `StyleSheet` | Custom fintech tokens in `theme.ts` (colors, spacing, radiuses) |

### Backend API (`/backend`)
| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Runtime** | Node.js 22 LTS | Fast execution with modern ES modules |
| **Framework** | Express 5.3 + TypeScript | Type-safe REST API endpoints |
| **Database** | PostgreSQL (Neon Serverless) | Cloud-native pooled PostgreSQL |
| **ORM** | Prisma ORM 7 (`@prisma/client`) | Prisma Client with `@prisma/adapter-pg` driver adapter |
| **Connection Pool** | `pg` (node-postgres) | Connection pooling with tuned keep-alive timeouts |
| **Authentication** | `jsonwebtoken` (`HS256`) | Bearer token signing, verification, and expiry checks |
| **SMS / OTP** | Twilio Verify API v2 | Managed SMS verification service with dev fallback |
| **File Uploads** | `multer` (Memory Storage) | 5 MB upload limit, strict image MIME type validation |
| **Cloud Storage** | Cloudinary v2 SDK | Persistent cloud CDN image hosting with local disk fallback |

---

## 📁 Repository Structure

```
Miniledger/
├── backend/                                # Express + TypeScript Backend
│   ├── prisma/
│   │   ├── schema.prisma                   # Prisma 7 schema (User, OtpRecord, Loan, Repayment, Receipt)
│   │   └── schema.sql                      # Raw PostgreSQL DDL reference with NUMERIC constraints
│   ├── src/
│   │   ├── db/
│   │   │   ├── prisma.ts                   # Prisma client + node-postgres connection pool configuration
│   │   │   ├── store.ts                    # Database store, queries, decimal mappings, transactions
│   │   │   └── types.ts                    # TypeScript domain interfaces and DTOs
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts           # JWT extraction and validation middleware
│   │   ├── routes/
│   │   │   ├── authRoutes.ts               # POST /send-otp, POST /verify-otp, GET /me
│   │   │   ├── dashboardRoutes.ts          # GET /summary
│   │   │   ├── healthRoutes.ts             # GET /health, POST /seed-sample-loans
│   │   │   ├── loanRoutes.ts               # GET /loans, POST /loans, PATCH /repay, PATCH /mark-repaid
│   │   │   └── receiptRoutes.ts            # POST /stage, POST /:id/receipt, DELETE /:id/receipt, GET /file/:filename
│   │   ├── services/
│   │   │   ├── authService.ts              # Phone normalization, OTP lifecycle, JWT generation/verification
│   │   │   ├── storageService.ts           # Cloudinary uploader + local disk storage fallback
│   │   │   ├── twilioVerifyService.ts      # Twilio Verify v2 integration & error mapping
│   │   │   └── smsService.ts               # Fallback SMS provider dispatcher
│   │   ├── tests/
│   │   │   ├── miniledger.test.ts          # Business logic, decimal arithmetic, repayments, and overdue tests
│   │   │   └── jwt_auth_e2e.test.ts        # Authentication, token lifecycle, and tenant isolation tests
│   │   └── index.ts                        # Server entry point, CORS, logging, route registration
│   ├── uploads/
│   │   └── receipts/                       # Local disk storage directory for uploaded receipts (gitignored)
│   ├── .env.example                        # Backend environment variable template
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                                 # React Native + Expo Mobile Application
│   ├── assets/                             # App icons, splash screens, tab icons
│   ├── src/
│   │   ├── app/
│   │   │   ├── _layout.tsx                 # Root layout with QueryClientProvider, AuthProvider, Theme
│   │   │   ├── index.tsx                   # Home screen (Financial Dashboard & Recent Loans)
│   │   │   ├── loans.tsx                   # Loans screen (List, Search, Status Filter Chips)
│   │   │   ├── add-loan.tsx                # Add Loan screen (Form, Amount Chips, Due Date, Receipt Upload)
│   │   │   ├── profile.tsx                 # Profile screen (User details, API Health, Seeding, Logout)
│   │   │   └── explore.tsx                 # Tab redirect helper
│   │   ├── components/
│   │   │   ├── app-tabs.tsx                # Bottom tab bar trigger definitions
│   │   │   ├── AuthModal.tsx               # Phone number entry & 6-digit OTP verification modal
│   │   │   ├── ConfirmationModal.tsx       # Generic modal for destructive action confirmations
│   │   │   ├── DatePickerInput.tsx         # Custom interactive monthly calendar modal & quick presets
│   │   │   ├── LoanCard.tsx                # Loan summary card with progress bar and badges
│   │   │   ├── LoanDetailModal.tsx         # Loan details, repayment history, settle & receipt actions
│   │   │   ├── RepaymentModal.tsx          # Installment repayment recording modal
│   │   │   ├── StatusBadge.tsx             # Color-coded loan status pill (Active, Overdue, Repaid, etc.)
│   │   │   └── SummaryCard.tsx             # Metric card for total lent, repaid, and balance figures
│   │   ├── constants/
│   │   │   └── theme.ts                    # Fintech design tokens (Colors, Spacing, BorderRadius, Fonts)
│   │   ├── context/
│   │   │   └── AuthContext.tsx             # Authentication state provider & session persistence
│   │   ├── hooks/
│   │   │   └── useLoansQuery.ts            # React Query hooks for dashboard, loans list, and mutations
│   │   ├── services/
│   │   │   ├── api.ts                      # Reusable HTTP client, dynamic LAN host resolution, multipart builder
│   │   │   └── queryClient.ts              # TanStack Query client configuration and query keys
│   │   └── utils/
│   │       └── format.ts                   # INR currency formatters and relative due date calculators
│   ├── app.json                            # Expo app manifest & configuration
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore                              # Monorepo ignore rules (node_modules, .env, uploads, dist)
└── README.md                               # Complete project documentation (this file)
```

---

## ⚡ Prerequisites

- **Node.js**: `v20.x` or `v22.x` LTS (tested with Node `v22.20.0`).
- **Package Manager**: `npm` (comes bundled with Node.js).
- **PostgreSQL Database**: A hosted PostgreSQL instance (recommended: [Neon](https://neon.tech) free tier) or local PostgreSQL >= 15.
- **Expo Go App**: Optional, install on an Android or iOS physical device from Google Play Store or Apple App Store.
- **Cloudinary Account**: Optional, for permanent cloud storage of receipt photos ([cloudinary.com](https://cloudinary.com)).

---

## 🔐 Environment Configuration

### 1. Backend (`backend/.env`)

Create `backend/.env` by copying `backend/.env.example`:

```bash
cd backend
cp .env.example .env
```

Populate the variables with your configuration values:

```env
# Server Port & Mode
PORT=5000
NODE_ENV=development

# Neon PostgreSQL Connection String (must include sslmode=require for Neon)
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@<NEON_HOST>/<DB_NAME>?sslmode=require"

# JWT Signing Secret (must be a secure random string, min 32 characters in production)
JWT_SECRET="your_secure_random_64_character_hex_secret_here"

# SMS OTP Provider: 'mock' for local development logging, or 'twilio' for real SMS
SMS_PROVIDER=mock

# Twilio Verify API Credentials (optional for local evaluation; required for real SMS)
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_API_KEY=SKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_API_SECRET=your_twilio_api_secret_here
TWILIO_VERIFY_SERVICE_SID=VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Cloudinary Media Storage (optional for dev; if omitted, receipts save locally to backend/uploads/receipts)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

> [!CAUTION]
> Never commit `.env` files to source control. Ensure `.gitignore` contains `.env` and `.env.*`.

---

### 2. Mobile Client (`mobile/.env`)

Create `mobile/.env` in the `mobile` directory:

```bash
cd mobile
touch .env
```

Configure `EXPO_PUBLIC_API_URL` based on your target device:

```env
# For Web browser (running on http://localhost:8081) or iOS Simulator:
EXPO_PUBLIC_API_URL="http://localhost:5000"

# For Android Emulator (uses Android host loopback 10.0.2.2):
# EXPO_PUBLIC_API_URL="http://10.0.2.2:5000"

# For Physical Phone (Expo Go on same Wi-Fi network, use your computer's local LAN IP):
# EXPO_PUBLIC_API_URL="http://192.168.1.100:5000"
```

> [!TIP]
> If `EXPO_PUBLIC_API_URL` is omitted on a physical phone, MiniLedger dynamically resolves the host machine's LAN IP address directly from Metro bundler's configuration (`Constants.expoConfig.hostUri`).

---

## 🗄️ Database Setup (Neon PostgreSQL & Prisma)

MiniLedger uses **Prisma ORM** backed by **Neon Serverless PostgreSQL** with exact `Decimal` precision for financial values.

### 1. Provision a Neon Database
1. Go to [neon.tech](https://neon.tech) and create a free project.
2. Select your preferred region (e.g., `AWS us-east-2` or closest to your users).
3. Copy the pooled connection string provided in the Neon dashboard (e.g., `postgresql://user:pass@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`).
4. Paste it into `backend/.env` as `DATABASE_URL`.

### 2. Push Schema to Database
From the `backend` directory, synchronize the Prisma schema with PostgreSQL:

```bash
cd backend
npm install
npx prisma db push
```

This creates the tables (`users`, `otp_records`, `loans`, `repayments`, `receipts`), indexes, and cascade foreign-key relationships.

### 3. Generate Prisma Client
```bash
npx prisma generate
```

*(Optional)* You can visually inspect your database tables anytime by running:
```bash
npx prisma studio
```

---

## 🚀 Running the Application

### 1. Start the Backend API

```bash
cd backend
npm run dev
```

The Express API server starts on `http://localhost:5000` with hot-reloading enabled via `tsx watch`. On startup, you will see a banner confirming the local URL, health endpoint, and database connectivity.

To verify backend health:
```bash
curl http://localhost:5000/api/health
```

### 2. Start the Mobile Client

Open a second terminal window:

```bash
cd mobile
npm install
npx expo start
```

Press:
- **`w`** to open the web version in your browser (`http://localhost:8081`).
- **`a`** to launch on a connected Android Emulator.
- **`i`** to launch on an iOS Simulator (macOS only).
- Or scan the displayed QR code with the **Expo Go** app on your physical smartphone.

---

## 📱 Connecting a Physical Device (Expo Go)

To run MiniLedger on a physical smartphone (Android or iOS):

1. **Connect to the Same Network**: Ensure your computer and smartphone are connected to the same Wi-Fi router.
2. **Find Your Computer's Local LAN IP**:
   - **Windows**: Run `ipconfig` in Command Prompt (look for IPv4 Address under Wi-Fi, e.g., `192.168.1.15`).
   - **macOS / Linux**: Run `ifconfig` or `ip a` (look for `inet 192.168.x.x`).
3. **Configure the Mobile Environment**:
   In `mobile/.env`, set:
   ```env
   EXPO_PUBLIC_API_URL="http://192.168.1.15:5000"
   ```
   *(Replace `192.168.1.15` with your computer's actual LAN IP).*
4. **Firewall Rule**: Ensure your computer's firewall allows incoming connections on port `5000` (Backend API) and port `8081` (Metro Bundler).
5. **Open Expo Go**:
   - **Android**: Open the Expo Go app and tap "Scan QR code".
   - **iOS**: Open the native Camera app and tap the prompt to open in Expo Go.

---

## 🔑 Authentication & OTP Workflow

MiniLedger uses phone-number-based authentication tailored for Indian mobile numbers (`+91`).

### Authentication Flow
```
User Enters Phone (+91XXXXXXXXXX)
              │
              ▼
    POST /api/auth/send-otp
              │
      ┌───────┴───────┐
      │               │
Twilio Configured?   Mock Mode (Default)
      │               │
      ▼               ▼
Real SMS Sent   OTP Printed to Backend Console
      │               │
      └───────┬───────┘
              ▼
User Enters 6-Digit Code
              │
              ▼
   POST /api/auth/verify-otp
              │
              ▼
Valid? ──Yes──► Upsert User in DB ──► Return Signed JWT Token (30 Days)
  │
  No
  │
  ▼
Error (Max 3 Attempts Allowed)
```

### Twilio Verify API vs. Development Mock Mode

| Feature | Twilio Verify API | Development Mock Mode (Default) |
| :--- | :--- | :--- |
| **Trigger** | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, and `TWILIO_VERIFY_SERVICE_SID` present | Default when Twilio keys are omitted or `SMS_PROVIDER=mock` |
| **Delivery** | Sends real SMS via Twilio's managed verification channel | Logs 6-digit code to the terminal running `backend` |
| **Cost** | Consumes Twilio balance per verification | Free ($0.00) |
| **Cooldown** | 30 seconds resend cooldown | 30 seconds resend cooldown |
| **Max Attempts** | 3 verification attempts | 3 verification attempts |
| **Token Issued** | Standard signed JWT (30 days) | Standard signed JWT (30 days) |

### Twilio Trial Account Limitations
If you test with a **Twilio Trial Account**, be aware of these restrictions:
1. **Error 21608 (Verified Caller IDs)**: Twilio trial accounts **cannot send SMS to unverified phone numbers**. You must add and verify recipient phone numbers in the [Twilio Console > Phone Numbers > Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified).
2. **Trial Message Prefix**: SMS messages will be prefixed with `Sent from your Twilio trial account -`.
3. **Carrier / DND Filtering**: In India, promotional/unregistered SMS traffic is strictly regulated by TRAI (Telecom Regulatory Authority of India). Real SMS delivery to numbers registered on the national DND registry may be blocked unless delivered via Twilio Verify's registered routes.
4. **Recommended Evaluation**: For seamless testing without Twilio trial restrictions or carrier delays, leave `SMS_PROVIDER=mock` and read the code from your backend terminal.

---

## 📷 Receipt Photo Storage & Upload Architecture

MiniLedger allows attaching transfer proof, UPI receipts, or invoice photos to any loan.

### Storage Architecture
- **Authenticated Cloudinary Storage**:
  When `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are configured in `backend/.env`, uploaded receipts are streamed securely to Cloudinary folder `miniledger/receipts` using `type: 'authenticated'`. Direct, public access without a signature is rejected by Cloudinary with `401 Unauthorized`. Receipts are delivered exclusively via cryptographically signed URLs generated dynamically on authenticated loan queries.
- **Local Disk Storage (Fallback)**:
  When Cloudinary credentials are not present in `.env`, the backend falls back to local storage in `backend/uploads/receipts/<uuid>.<ext>`.
- **Protected File Access & Orphan Prevention**:
  Receipt retrieval enforces authentication and loan ownership. Upload failures automatically trigger Cloudinary asset rollbacks, and unassociated staged uploads expire to prevent orphaned media.

### Mobile Upload Engine
Expo SDK 58 / React Native 0.88 uses a WinterCG-compliant fetch engine (`expo/fetch`). Appending legacy React Native `{ uri, name, type }` objects directly to `FormData` throws `[Error: Unsupported FormDataPart implementation]`. 

MiniLedger resolves this natively:
```typescript
// mobile/src/services/api.ts
import { File as ExpoFile } from 'expo-file-system';

// Constructs a WinterCG-compliant File part implementing Blob and .bytes()
const file = new ExpoFile(fileUri);
Object.defineProperty(file, 'name', { value: filename, writable: true, configurable: true, enumerable: true });
Object.defineProperty(file, 'type', { value: mimeType, writable: true, configurable: true, enumerable: true });
formData.append('receipt', file as any, filename);
```

### Current Storage Limitations
- **Ephemeral Storage in Cloud Hosting**: If deployed to serverless or container platforms with ephemeral disks (Render, Railway, Fly.io, Vercel) without Cloudinary credentials, files saved to `backend/uploads/` will be wiped on restart. Cloudinary credentials must be set for persistent cloud storage.
- **Single Receipt Per Loan**: The database schema enforces `@unique` on `receipt.loanId` (one-to-one relationship). Attaching a new receipt replaces the previous one. Multiple attachments per loan are not currently supported.
- **Supported Formats**: Accepts `image/jpeg`, `image/png`, `image/webp`, `image/heic`, and `image/heif` up to 5 MB. PDF documents are not supported.

---

## 📡 API Endpoints Reference

All endpoints return standardized JSON responses:
- Success: `{ "success": true, "data": ... }` or `{ "success": true, "message": "..." }`
- Error: `{ "success": false, "error": "Human-readable explanation" }`

### 1. System & Health
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Root service status check. |
| `GET` | `/api/health` | Public | Service health, uptime, and database connection status. |
| `POST` | `/api/seed-sample-loans` | Bearer Token | Seeds 3 realistic sample loans (active, overdue, partially repaid). |

### 2. Authentication
| Method | Endpoint | Auth | Request Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/send-otp` | Public | `{ "phone": "9876543210" }` | Validates phone and dispatches 6-digit OTP (Twilio Verify or Mock). |
| `POST` | `/api/auth/verify-otp` | Public | `{ "phone": "9876543210", "otp": "123456", "name": "Aarav" }` | Verifies OTP, upserts user in DB, and returns signed 30-day JWT. |
| `GET` | `/api/auth/me` | Bearer Token | — | Returns profile details of the authenticated user. |

### 3. Financial Dashboard
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Bearer Token | Returns aggregate metrics (`totalLent`, `totalRepaid`, `outstanding`, `overdueAmount`, `activeLoansCount`, `overdueLoansCount`, `recentLoans`). |

### 4. Loans
| Method | Endpoint | Auth | Request / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/loans` | Bearer Token | Query: `?search=rahul&status=ACTIVE` | Lists loans sorted by `createdAt: 'desc'`. Filter by `ALL`, `ACTIVE`, `OVERDUE`, `REPAID`. |
| `GET` | `/api/loans/:id` | Bearer Token | URL param: `id` (loan UUID) | Fetches complete loan details, repayment history, and receipt proof. |
| `POST` | `/api/loans` | Bearer Token | `{ "friendName": "Rahul", "amount": 5000, "dueDate": "ISO_STRING", "notes": "...", "receipt": { ... } }` | Creates a new loan record. Fast single-query execution. |
| `PATCH` | `/api/loans/:id/repay` | Bearer Token | `{ "amount": 2000, "notes": "UPI", "repaymentDate": "ISO_STRING" }` | Transactionally records an installment, deducts balance, and recalculates status. |
| `PATCH` | `/api/loans/:id/mark-repaid` | Bearer Token | `{ "notes": "Settled in full" }` | Fully settles remaining balance in a single database transaction. |

### 5. Receipts & Media
| Method | Endpoint | Auth | Content Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/receipts/stage` | Bearer Token | `multipart/form-data` (key: `receipt`) | Stages a photo before loan creation; returns upload URL and metadata. |
| `POST` | `/api/loans/:id/receipt` | Bearer Token | `multipart/form-data` (key: `receipt`) | Uploads and links a receipt photo directly to an existing loan. |
| `DELETE` | `/api/loans/:id/receipt` | Bearer Token | — | Removes receipt from a loan and deletes file from storage. |
| `GET` | `/api/receipts/file/:filename` | Token Header or `?token=` query | — | Authenticated file server for local development receipts. |

---

## 🧪 Testing & Verification

The backend includes automated test suites covering business rules, transactional decimal math, security isolation, and Twilio error sanitization.

### Run All Backend Tests
```bash
cd backend
npm test
```

### Test Suites Included
1. **`miniledger.test.ts` (Business Logic & Database Store)**:
   - Phone number normalization and validation for Indian mobile numbers.
   - OTP lifecycle: 30s resend cooldown, 5-minute expiration, and 3-attempt limit.
   - Positive loan amount enforcement and initial balance calculations.
   - Initial status calculation (sets `OVERDUE` if due date is in the past).
   - Atomic partial repayments with decimal safety.
   - Rejection of excessive repayments (`repayment > remainingBalance`).
   - Rejection of non-positive repayments (`amount <= 0`).
   - Full settlement transitions to `REPAID`.
   - Dynamic overdue calculation safeguards.
   - Aggregate dashboard summary arithmetic.
   - Cross-tenant data isolation between test accounts.
   - Receipt attachment, ownership verification, and deletion.
2. **`jwt_auth_e2e.test.ts` (End-to-End JWT Security)**:
   - Token issuance and validity verification.
   - Rejection of missing, malformed, or tampered JWT signatures.
   - Enforcement of user data isolation (User A cannot read or modify User B's debts).
3. **`twilioVerifyService` Unit Verification**:
   - Environment variable validation without leaking secret values in logs.
   - E.164 phone number formatting (`+91XXXXXXXXXX`).
   - Twilio trial error code mapping (e.g. Error 21608 unverified recipient).

---

## 🛡️ Security Architecture

- **Precision Decimal Financial Math**: All currency calculations in PostgreSQL use `NUMERIC(12, 2)` and Prisma's `Prisma.Decimal` class to eliminate binary floating-point rounding errors (e.g., `0.1 + 0.2 !== 0.3`).
- **Database Transactions (`$transaction`)**: Repayments and settlements are wrapped in ACID transactions, preventing partial updates or phantom balances.
- **Tenant Isolation**: Every database query for loans, receipts, and summaries strictly filters by `userId` extracted from the verified JWT payload.
- **CORS Protection**: Configured with explicit HTTP method and header whitelists.
- **Credential Protection**:
  - No secrets, credentials, or private URLs are hardcoded in the codebase.
  - Test suites and server logs automatically redact tokens and phone numbers.
  - `.env` files are excluded in `.gitignore`.
- **File Upload Safeguards**:
  - Whitelist filter on incoming MIME types (`JPEG`, `PNG`, `WebP`, `HEIC`).
  - 5 MB maximum file size limit enforced via `multer`.
  - Secure random UUID filenames prevent path traversal attacks.

---

## ❓ Troubleshooting Guide

### 1. Database Connection Issues
- **Error**: `FATAL DATABASE ERROR: Could not connect to PostgreSQL database.`
  - **Fix**: Check `DATABASE_URL` in `backend/.env`. Ensure `sslmode=require` is present at the end of the connection string if connecting to Neon.
  - **Check**: Test connection directly with `npx prisma db push`.
- **Error**: `Foreign key constraint violated on the constraint: loans_userId_fkey`
  - **Fix**: Occurs if a loan is created with a non-existent `userId`. Ensure you are authenticated and your user record exists in the `users` table.

### 2. Network & Phone Connection Issues (Expo Go)
- **Error**: `Cannot connect to MiniLedger backend at http://localhost:5000` (on a physical phone)
  - **Cause**: `localhost` on a physical smartphone refers to the phone itself, not your development computer.
  - **Fix**: Set `EXPO_PUBLIC_API_URL="http://<YOUR_COMPUTER_LAN_IP>:5000"` in `mobile/.env`. Ensure your phone and computer are on the same Wi-Fi. Check that your computer's firewall allows incoming connections on port 5000.
- **Error**: `Network request failed`
  - **Fix**: Verify backend is running on `http://localhost:5000` (`npm run dev`). Verify phone can reach `http://<YOUR_LAN_IP>:5000/api/health` from the phone's mobile browser.

### 3. OTP & Twilio Issues
- **Error**: `Twilio Trial Account Restriction: The destination phone number is not verified (Error 21608)`
  - **Cause**: Twilio trial accounts only permit SMS delivery to numbers registered as "Verified Caller IDs".
  - **Fix**: Add your phone number in the [Twilio Console > Phone Numbers > Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified), or switch to `SMS_PROVIDER=mock` in `backend/.env` to view OTPs in the backend console.
- **Error**: `Please wait 30s before requesting a new OTP`
  - **Fix**: A 30-second cooldown is enforced between OTP dispatches to prevent SMS spam. Wait for the countdown timer on the screen to reach zero.
- **Error**: `Maximum verification attempts reached`
  - **Fix**: For security, an OTP record is locked after 3 incorrect attempts. Request a new OTP.

### 4. Receipt Upload Issues
- **Error**: `[Error: Unsupported FormDataPart implementation]`
  - **Cause**: Older React Native file-upload objects (`{ uri, name, type }`) are rejected by Expo's modern WinterCG fetch engine.
  - **Fix**: Resolved in code using `expo-file-system`'s `File` implementation. Ensure you have run `npm install` in `mobile/` to link dependencies.
- **Error**: `Invalid file type: ... Allowed types: JPG, PNG, WebP, HEIC`
  - **Fix**: Upload only image files. PDF and text documents are not supported.

---

## 🔮 Roadmap & Future Improvements

1. **Automated Reminders**: Push notifications or WhatsApp reminders for borrowers when a loan is approaching due date or overdue.
2. **Multi-Currency Support**: Expand beyond INR to support USD, EUR, and GBP with real-time exchange rates.
3. **Split Expenses**: Group expense splitting module to divide restaurant or trip bills across multiple friends.
4. **Export Statements**: PDF and CSV export of annual or monthly lending summaries for tax and personal records.
5. **Multiple Receipts per Loan**: Allow uploading multiple invoices, contracts, and payment receipts against a single debt.
