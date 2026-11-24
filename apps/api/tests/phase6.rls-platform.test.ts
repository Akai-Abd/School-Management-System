import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signOfflineLicense, verifyOfflineLicense } from '../src/lib/license.js';
import { prisma } from '../src/lib/prisma.js';

let dbReady = false;
let schoolAId = '';
let schoolBId = '';

describe('Phase 6–7 RLS, offline licensing, and platform controls', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
      const suffix = `rls-${Date.now()}`;
      const [sA, sB] = await Promise.all([
        prisma.school.create({ data: { name: `RLS A ${suffix}`, slug: `rls-a-${suffix}` } }),
        prisma.school.create({ data: { name: `RLS B ${suffix}`, slug: `rls-b-${suffix}` } }),
      ]);
      schoolAId = sA.id;
      schoolBId = sB.id;
      await Promise.all([
        prisma.schoolSetting.create({ data: { schoolId: schoolAId, locale: 'en-IN' } }),
        prisma.schoolSetting.create({ data: { schoolId: schoolBId, locale: 'en-US' } }),
      ]);
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (!dbReady) return;
    const ids = [schoolAId, schoolBId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.schoolSetting.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.school.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  it('should verify valid, grace, expired, and tampered offline standalone licenses', () => {
    const secret = 'test-license-secret-key-32-chars';
    const signed = signOfflineLicense(
      {
        schoolSlug: 'demo-school',
        schoolName: 'Demo School',
        expiresAt: '2026-12-01T00:00:00Z',
        graceDays: 14,
        modules: ['students', 'fees'],
      },
      secret,
    );

    expect(verifyOfflineLicense(signed.payload, signed.signature, secret, new Date('2026-11-25T00:00:00Z')).status).toBe(
      'valid',
    );
    expect(verifyOfflineLicense(signed.payload, signed.signature, secret, new Date('2026-12-10T00:00:00Z')).status).toBe(
      'grace',
    );
    expect(verifyOfflineLicense(signed.payload, signed.signature, secret, new Date('2026-12-20T00:00:00Z')).valid).toBe(
      false,
    );
    expect(verifyOfflineLicense(signed.payload, '0'.repeat(64), secret).status).toBe('invalid_signature');
  });

  it('should enforce PostgreSQL FORCE ROW LEVEL SECURITY with SET LOCAL app.current_school_id', async () => {
    if (!dbReady) return;

    const visibleRows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE school_erp_app`);
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolAId}, true)`;
      return tx.schoolSetting.findMany({ where: { schoolId: { in: [schoolAId, schoolBId] } } });
    });

    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0]?.schoolId).toBe(schoolAId);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE school_erp_app`);
        await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolAId}, true)`;
        await tx.feeType.create({
          data: { schoolId: schoolBId, name: 'Cross-tenant leak', code: 'LEAK' },
        });
      }),
    ).rejects.toThrow();
  });

  it('should expose Phase 6 OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/platform/schools']).toBeDefined();
    expect(openapi.body.paths['/api/v1/settings/export.json']).toBeDefined();

    expect((await request(app).get('/api/v1/platform/schools')).status).toBe(401);
    expect((await request(app).get('/api/v1/settings/export.json')).status).toBe(401);
  });
});
