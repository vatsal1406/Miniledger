import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { dbStore } from '../db/store.js';
import { authService } from '../services/authService.js';
import { prisma } from '../db/prisma.js';

const BASE_URL = process.env['TEST_BASE_URL'] || 'http://localhost:5000';

describe('MiniLedger JWT End-to-End Security & Ownership Test Suite', () => {
  let userA: { id: string; phone: string };
  let userB: { id: string; phone: string };
  let loanB_Id: string;
  let validTokenA: string;
  let validTokenB: string;

  before(async () => {
    // Generate isolated test accounts in Neon PostgreSQL
    userA = await dbStore.upsertUser('9811122233', 'Security Test User A');
    userB = await dbStore.upsertUser('9822233344', 'Security Test User B');

    // Clean any prior test fixtures for these test users
    await prisma.receipt.deleteMany({
      where: { loan: { userId: { in: [userA.id, userB.id] } } },
    });
    await prisma.repayment.deleteMany({
      where: { loan: { userId: { in: [userA.id, userB.id] } } },
    });
    await prisma.loan.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });

    // Create User B's private loan
    const loanB = await dbStore.createLoan({
      userId: userB.id,
      friendName: 'User B Friend',
      amount: 15000,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: 'User B private debt',
    });
    loanB_Id = loanB.id;

    validTokenA = authService.generateToken(userA.id, userA.phone);
    validTokenB = authService.generateToken(userB.id, userB.phone);
  });

  after(async () => {
    // Clean up test data
    await prisma.receipt.deleteMany({
      where: { loan: { userId: { in: [userA.id, userB.id] } } },
    });
    await prisma.repayment.deleteMany({
      where: { loan: { userId: { in: [userA.id, userB.id] } } },
    });
    await prisma.loan.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.$disconnect();
  });

  // Test 1: No token on a protected endpoint -> 401
  it('1. No token on a protected endpoint -> should return 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/loans`);
    assert.equal(res.status, 401, `Expected status 401, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /Authentication required/i);
  });

  // Test 2: Malformed token -> 401
  it('2. Malformed token -> should return 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: {
        Authorization: 'Bearer this-is-not-a-valid-jwt-token-structure',
      },
    });
    assert.equal(res.status, 401, `Expected status 401, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /Invalid or malformed/i);
  });

  // Test 3: Token signed with the wrong secret -> 401
  it('3. Token signed with the wrong secret -> should return 401 Unauthorized', async () => {
    const bogusSecretToken = jwt.sign(
      { userId: userA.id, phone: userA.phone },
      'completely-bogus-secret-key-1234567890',
      { algorithm: 'HS256', expiresIn: '30d' }
    );

    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: {
        Authorization: `Bearer ${bogusSecretToken}`,
      },
    });
    assert.equal(res.status, 401, `Expected status 401, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /Invalid or malformed/i);
  });

  // Test 4: Expired token -> 401
  it('4. Expired token -> should return 401 Unauthorized', async () => {
    // Generate token that expired 5 seconds ago
    const expiredToken = authService.generateToken(userA.id, userA.phone, '-5s');

    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });
    assert.equal(res.status, 401, `Expected status 401, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /expired/i);
  });

  // Test 5: Valid token for an authenticated user -> Request proceeds (200 OK)
  it('5. Valid token for authenticated user -> should proceed and return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: {
        Authorization: `Bearer ${validTokenA}`,
      },
    });
    assert.equal(res.status, 200, `Expected status 200, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  // Test 6: User A attempts to access User B's loan -> Access denied (404/403)
  it("6. User A attempts to access User B's loan -> should return 404 (Access Denied / Isolated)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans/${loanB_Id}`, {
      headers: {
        Authorization: `Bearer ${validTokenA}`, // User A's token
      },
    });
    // System returns 404 so User A cannot even deduce existence of User B's loan
    assert.equal(res.status, 404, `Expected status 404, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /Loan not found/i);
  });

  // Test 7: User A attempts to modify User B's loan -> Access denied (400/404)
  it("7. User A attempts to modify User B's loan -> should reject modification", async () => {
    const res = await fetch(`${BASE_URL}/api/loans/${loanB_Id}/repay`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validTokenA}`, // User A's token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 500, notes: 'Malicious unauthorized repayment' }),
    });
    assert.ok(
      res.status === 400 || res.status === 404,
      `Expected status 400 or 404, got ${res.status}`
    );
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /not authorized|not found/i);
  });

  // Test 8: Valid token with a tampered payload -> 401
  it('8. Valid token with a tampered payload -> should return 401 Unauthorized', async () => {
    // Split valid token into parts and tamper payload
    const parts = validTokenA.split('.');
    assert.equal(parts.length, 3, 'Valid JWT must have 3 parts');

    // Decode payload, modify userId to User B's id, and re-encode without matching secret signature
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const tamperedPayload = JSON.parse(payloadStr);
    tamperedPayload.userId = userB.id; // Tampering identity claim

    const tamperedPayloadEncoded = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayloadEncoded}.${parts[2]}`; // Reattached original signature

    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: {
        Authorization: `Bearer ${tamperedToken}`,
      },
    });
    assert.equal(res.status, 401, `Expected status 401, got ${res.status}`);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /Invalid or malformed/i);
  });

  after(async () => {
    await prisma.$disconnect();
  });
});

