import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { admitStudentSchema, createAcademicYearSchema, createStaffSchema } from '@school-erp/contracts';
import { createApp } from '../src/app.js';
import { validateTermAgainstYear } from '../src/modules/academic/academic.routes.js';
import { parseCsvText, validateImportRows } from '../src/modules/imports/imports.routes.js';
import { findDisallowedSubjects } from '../src/modules/students/students.routes.js';

describe('Phase 1 core administration domain & security checks', () => {
  it('should enforce academic term boundaries and non-overlapping rules (M04-AC7)', () => {
    const yearStart = new Date('2026-04-01');
    const yearEnd = new Date('2027-03-31');
    const existing = [{ name: 'Term 1', startDate: new Date('2026-04-01'), endDate: new Date('2026-09-30') }];

    expect(
      validateTermAgainstYear(new Date('2026-03-15'), new Date('2026-05-01'), yearStart, yearEnd, []),
    ).toMatch(/within the academic year/);

    expect(
      validateTermAgainstYear(new Date('2026-09-15'), new Date('2026-12-20'), yearStart, yearEnd, existing),
    ).toMatch(/overlap/);

    expect(
      validateTermAgainstYear(new Date('2026-10-01'), new Date('2027-03-31'), yearStart, yearEnd, existing),
    ).toBeNull();
  });

  it('should reject elective subjects not offered for class/year (M04-AC6)', () => {
    expect(findDisallowedSubjects(['sub-1', 'sub-2'], ['sub-1', 'sub-99'])).toEqual(['sub-99']);
    expect(findDisallowedSubjects(['sub-1', 'sub-2'], ['sub-2'])).toEqual([]);
  });

  it('should parse CSV rows with quoted commas and report row-level errors/duplicates (M18-AC1/AC3)', () => {
    const csv = [
      'full_name,email,joining_date,is_teacher',
      '"Doe, Jane",jane@school.local,2026-06-01,true',
      'John Duplicate,jane@school.local,2026-06-02,false',
      'Bad Date,bad@school.local,not-a-date,false',
    ].join('\n');

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.full_name).toBe('Doe, Jane');

    const errors = validateImportRows('staff', rows, new Set(['existing@school.local']));
    expect(errors).toEqual([
      { row: 3, message: 'Duplicate staff email: jane@school.local' },
      { row: 4, message: 'joining_date must be YYYY-MM-DD' },
    ]);
  });

  it('should validate academic, staff, and student admission Zod schemas', () => {
    expect(
      createAcademicYearSchema.parse({ name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' }).isCurrent,
    ).toBe(false);
    expect(() =>
      createStaffSchema.parse({ fullName: 'A', joiningDate: 'bad-date' }),
    ).toThrow();
    expect(() =>
      admitStudentSchema.parse({
        firstName: 'Ali',
        lastName: 'Khan',
        dateOfBirth: '2016-05-01',
        gender: 'male',
        academicYearId: '00000000-0000-0000-0000-000000000001',
        classId: '00000000-0000-0000-0000-000000000002',
        sectionId: '00000000-0000-0000-0000-000000000003',
        guardians: [],
      }),
    ).toThrow();
  });

  it('should expose Phase 1 core admin OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/academic/years']).toBeDefined();
    expect(openapi.body.paths['/api/v1/staff']).toBeDefined();
    expect(openapi.body.paths['/api/v1/students']).toBeDefined();
    expect(openapi.body.paths['/api/v1/imports/preview']).toBeDefined();

    expect((await request(app).get('/api/v1/academic/years')).status).toBe(401);
    expect((await request(app).get('/api/v1/staff')).status).toBe(401);
    expect((await request(app).get('/api/v1/students')).status).toBe(401);
    expect((await request(app).post('/api/v1/imports/preview')).status).toBe(401);
  });
});
