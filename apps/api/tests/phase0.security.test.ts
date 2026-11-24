import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { forTenant } from '../src/lib/prisma.js';
import { detectAllowedMime, LocalStorageAdapter } from '../src/lib/storage.js';
import { requireCsrf, requirePermission, requirePlatformAdmin, requireSchoolContext } from '../src/middleware/auth.js';

describe('Phase 0 foundation security & configuration', () => {
  it('should fail fast when S3 driver is selected without credentials', () => {
    expect(() =>
      loadEnv({
        STORAGE_DRIVER: 's3',
        NODE_ENV: 'development',
      }),
    ).toThrow();
  });

  it('should fail fast in production with default session secret', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'dev-session-secret-change-in-production-32',
      }),
    ).toThrow();
  });

  it('should accept PNG/PDF magic bytes and reject SVG/HTML payloads', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pdf = Buffer.from('%PDF-1.7\n');
    const svg = Buffer.from('<svg onload="alert(1)"></svg>');
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');

    expect(detectAllowedMime(png)).toBe('image/png');
    expect(detectAllowedMime(pdf)).toBe('application/pdf');
    expect(() => detectAllowedMime(svg)).toThrow();
    expect(() => detectAllowedMime(html)).toThrow();
  });

  it('should block path traversal in LocalStorageAdapter', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'erp-storage-'));
    try {
      const adapter = new LocalStorageAdapter(dir);
      await expect(
        adapter.putObject({ key: '../../etc/passwd', body: Buffer.from('x'), contentType: 'text/plain' }),
      ).rejects.toThrow();
      await adapter.putObject({ key: 'school-1/doc.pdf', body: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' });
      const downloaded = await adapter.getDownload('school-1/doc.pdf');
      expect(downloaded.kind).toBe('stream');
      expect(downloaded.buffer?.toString()).toBe('%PDF-1.4');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('should reject empty schoolId in forTenant()', () => {
    expect(() => forTenant('')).toThrow();
  });

  it('should enforce CSRF token and origin checks on mutating requests', () => {
    const reqMissingCsrf = {
      method: 'POST',
      auth: { csrfToken: 'expected-token' },
      header: () => undefined,
    } as never;

    let capturedErr: unknown;
    requireCsrf(reqMissingCsrf, {} as never, (err) => {
      capturedErr = err;
    });
    expect((capturedErr as { statusCode: number }).statusCode).toBe(403);

    const reqValid = {
      method: 'POST',
      auth: { csrfToken: 'expected-token' },
      header: (name: string) => (name === 'x-csrf-token' ? 'expected-token' : undefined),
    } as never;
    let passedErr: unknown;
    requireCsrf(reqValid, {} as never, (err) => {
      passedErr = err;
    });
    expect(passedErr).toBeUndefined();
  });

  it('should block missing school context, missing permission, and standalone platform routes', () => {
    let err1: unknown;
    requireSchoolContext({ auth: { activeSchoolId: null } } as never, {} as never, (e) => {
      err1 = e;
    });
    expect((err1 as { statusCode: number }).statusCode).toBe(403);

    let err2: unknown;
    requirePermission('students.create')(
      { auth: { activeSchoolId: 's1', roles: ['teacher'], permissions: new Set(['students.view']) } } as never,
      {} as never,
      (e) => {
        err2 = e;
      },
    );
    expect((err2 as { statusCode: number }).statusCode).toBe(403);

    let err3: unknown;
    requirePlatformAdmin(
      { auth: { isPlatformAdmin: true } } as never,
      {} as never,
      (e) => {
        err3 = e;
      },
    );
    expect((err3 as { statusCode: number }).statusCode).toBe(404);
  });

  it('should expose healthz, OpenAPI 3.1 document, and reject unauthenticated file access', async () => {
    const app = createApp();

    const health = await request(app).get('/healthz');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.openapi).toBe('3.1.0');
    expect(openapi.body.paths['/api/v1/auth/login']).toBeDefined();

    const unauthFiles = await request(app).get('/api/v1/files/00000000-0000-0000-0000-000000000000/download');
    expect(unauthFiles.status).toBe(401);
  });

  it('should reject ENABLE_DEMO_QUICK_SIGNIN in production and return 404 when disabled', async () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'non-default-prod-secret-value-1234',
        ENABLE_DEMO_QUICK_SIGNIN: 'true',
      }),
    ).toThrow();

    const { env } = await import('../src/config/env.js');
    const prev = env.ENABLE_DEMO_QUICK_SIGNIN;
    env.ENABLE_DEMO_QUICK_SIGNIN = false;
    try {
      const app = createApp();
      const cfg = await request(app).get('/api/v1/auth/demo-config');
      expect(cfg.status).toBe(200);
      expect(cfg.body.quickSigninEnabled).toBe(false);

      const quick = await request(app).post('/api/v1/auth/quick-signin').send({ role: 'teacher' });
      expect(quick.status).toBe(404);
    } finally {
      env.ENABLE_DEMO_QUICK_SIGNIN = prev;
    }
  });
});
