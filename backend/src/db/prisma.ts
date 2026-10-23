import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL is required in environment variables. Refusing to run without persistent PostgreSQL.');
}

export const pgPool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 120000,
});

const adapter = new PrismaPg(pgPool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pgPool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
