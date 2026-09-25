import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from './app';
import { database } from './config/database';
import { healthRepository } from './modules/health/health.repository';
import { requireAuth } from './middlewares/auth.middleware';
import { requireRole } from './middlewares/role.middleware';
import { requirePermission } from './middlewares/permission.middleware';
import { validate } from './middlewares/validate.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { idParamsSchema } from '@blood/shared-validation';
import express from 'express';

const server = app.listen(0, '127.0.0.1');
let base: string;
before(async () => {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await database.$disconnect();
});
test('health returns 200 after a real PostgreSQL query', async () => {
  const response = await fetch(`${base}/api/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.database, 'connected');
  assert.equal(body.data.status, 'ok');
  assert.equal(typeof body.data.timestamp, 'string');
});
test('health returns 503 without leaking database errors', async (context) => {
  const mock = context.mock.method(healthRepository, 'ping', async () => {
    throw new Error('secret connection detail');
  });
  try {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.deepEqual(body, {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Không kết nối được cơ sở dữ liệu',
        fields: null,
      },
    });
    assert.ok(!JSON.stringify(body).includes('secret connection detail'));
  } finally {
    mock.mock.restore();
  }
});
test('unknown routes and invalid JSON use the error convention', async () => {
  const missing = await fetch(`${base}/api/unknown`);
  assert.equal(missing.status, 404);
  const missingBody = await missing.json();
  assert.equal(missingBody.success, false);
  assert.equal(missingBody.error.code, 'ROUTE_NOT_FOUND');
  assert.equal(missingBody.error.fields, null);

  const malformed = await fetch(`${base}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  const malformedBody = await malformed.json();
  assert.equal(malformedBody.success, false);
  assert.equal(malformedBody.error.code, 'REQUEST_INVALID');
});
test('middleware fails closed, validates input and handles async rejection', async () => {
  const fixture = express();
  fixture.get('/private', requireAuth, (_req, res) => res.sendStatus(204));
  fixture.get(
    '/admin',
    (req, _res, next) => {
      req.auth = {
        userId: 'fixture',
        roles: ['DONATION_STAFF'],
        permissions: ['screening.review'],
      };
      next();
    },
    requireRole('SYSTEM_ADMIN'),
    (_req, res) => res.sendStatus(204),
  );
  fixture.get(
    '/permission',
    (req, _res, next) => {
      req.auth = {
        userId: 'fixture',
        roles: ['DONATION_STAFF'],
        permissions: ['screening.review'],
      };
      next();
    },
    requirePermission('screening.review'),
    (_req, res) => res.sendStatus(204),
  );
  fixture.get('/ids/:id', validate(idParamsSchema, 'params'), (_req, res) =>
    res.json(res.locals.validated),
  );
  fixture.get('/failure', async () => {
    throw new Error('private diagnostic');
  });
  fixture.use(errorHandler);
  const local = fixture.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => local.once('listening', resolve));
  const url = `http://127.0.0.1:${(local.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${url}/private`)).status, 401);
    assert.equal((await fetch(`${url}/admin`)).status, 403);
    assert.equal((await fetch(`${url}/permission`)).status, 204);
    assert.equal((await fetch(`${url}/ids/invalid`)).status, 400);
    assert.equal(
      (await fetch(`${url}/ids/3d837fd0-7f76-48a4-8dde-15883dcd940a`)).status,
      200,
    );
    const failed = await fetch(`${url}/failure`);
    assert.equal(failed.status, 500);
    const failedBody = await failed.json();
    assert.equal(failedBody.success, false);
    assert.equal(failedBody.error.code, 'INTERNAL_ERROR');
    assert.equal(failedBody.error.message, 'Lỗi hệ thống');
  } finally {
    await new Promise<void>((resolve) => local.close(() => resolve()));
  }
});
