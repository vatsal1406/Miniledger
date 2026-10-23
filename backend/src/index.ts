import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter } from './routes/authRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { checkDatabaseConnection } from './db/prisma.js';
import { healthRouter } from './routes/healthRoutes.js';
import { loanRouter } from './routes/loanRoutes.js';
import { receiptRouter } from './routes/receiptRoutes.js';

export const app = express();
const PORT = process.env['PORT'] ? Number(process.env['PORT']) : 5000;

// CORS configuration for local mobile and web development
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Request logging in development
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/loans', loanRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', receiptRouter);
app.use('/api', healthRouter);

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'MiniLedger API',
    status: 'running',
    docs: '/api/health',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env['NODE_ENV'] === 'development' ? err.message : undefined,
  });
});

// Verify PostgreSQL connection on startup
checkDatabaseConnection()
  .then(() => {
    console.log('✅ PostgreSQL database connected successfully.');
  })
  .catch((err) => {
    console.error('❌ FATAL DATABASE ERROR: Could not connect to PostgreSQL database.');
    console.error(err.message);
    process.exit(1);
  });

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '╔'.padEnd(60, '═') + '╗');
  console.log('║  MiniLedger Express + TypeScript API Server              ║');
  console.log(`║  Local URL:   http://localhost:${PORT}                      ║`);
  console.log(`║  Health:      http://localhost:${PORT}/api/health               ║`);
  console.log('║  Auth Mode:   Mock 6-digit OTP (Printed in terminal)     ║');
  console.log(`║  Process PID: ${process.pid.toString().padEnd(42, ' ')} ║`);
  console.log('╚'.padEnd(60, '═') + '╝\n');
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
    console.error(`Please stop any other running backend instances or run: npx kill-port ${PORT}\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Clean shutdown on exit
const handleShutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
