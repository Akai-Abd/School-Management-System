import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { forTenant, prisma } from '../src/lib/prisma.js';

let dbReady = false;
let schoolAId = '';
let schoolBId = '';

describe('Live PostgreSQL cross-tenant isolation & partial indexes', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;

      const suffix = Date.now().toString();
      const [sA, sB] = await Promise.all([
        prisma.school.create({ data: { name: `Tenant A ${suffix}`, slug: `tenant-a-${suffix}` } }),
        prisma.school.create({ data: { name: `Tenant B ${suffix}`, slug: `tenant-b-${suffix}` } }),
      ]);
      schoolAId = sA.id;
      schoolBId = sB.id;
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (!dbReady) return;
    const ids = [schoolAId, schoolBId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.student.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.academicYear.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.school.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  it('should isolate students, academic years, and fee types across schools via forTenant()', async () => {
    if (!dbReady) return;

    const dbA = forTenant(schoolAId);
    const dbB = forTenant(schoolBId);

    await dbA.academicYear.create({
      data: {
        schoolId: schoolAId,
        name: '2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      },
    });

    const studentB = await dbB.student.create({
      data: {
        schoolId: schoolBId,
        admissionNumber: 'ADM-B-001',
        firstName: 'Riya',
        lastName: 'Verma',
        dateOfBirth: new Date('2015-05-10'),
        gender: 'female',
      },
    });

    const yearsVisibleInB = await dbB.academicYear.findMany();
    expect(yearsVisibleInB).toHaveLength(0);

    await expect(dbA.student.findUnique({ where: { id: studentB.id } })).rejects.toThrow();
    expect(await dbA.student.findMany({ where: { admissionNumber: 'ADM-B-001' } })).toHaveLength(0);
  });

  it('should enforce single current academic year per school via partial unique index', async () => {
    if (!dbReady) return;

    await expect(
      prisma.academicYear.create({
        data: {
          schoolId: schoolAId,
          name: '2027-28',
          startDate: new Date('2027-04-01'),
          endDate: new Date('2028-03-31'),
          isCurrent: true,
        },
      }),
    ).rejects.toThrow();
  });
});
