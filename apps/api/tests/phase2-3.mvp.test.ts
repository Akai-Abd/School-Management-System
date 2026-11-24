import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { validateMarkValue } from '../src/modules/exams/exams.routes.js';
import {
  assertDifferentApprover,
  computeInvoiceStatus,
  validatePaymentAllocation,
} from '../src/modules/fees/fees.routes.js';
import { detectTimetableConflict } from '../src/modules/timetable/timetable.routes.js';

describe('Phase 2 & 3A domain invariants and routes', () => {
  it('should detect section, teacher, and classroom timetable conflicts (M06-AC1..AC3)', () => {
    const existing = [
      {
        dayOfWeek: 1,
        periodId: 'p1',
        sectionId: 'sec-a',
        staffId: 't1',
        classroomId: 'r1',
        effectiveFrom: new Date('2026-04-01'),
        effectiveTo: null,
      },
    ];

    expect(
      detectTimetableConflict(existing, {
        dayOfWeek: 1,
        periodId: 'p1',
        sectionId: 'sec-a',
        staffId: 't2',
        classroomId: 'r2',
        effectiveFrom: new Date('2026-05-01'),
      }),
    ).toMatch(/Section/);

    expect(
      detectTimetableConflict(existing, {
        dayOfWeek: 1,
        periodId: 'p1',
        sectionId: 'sec-b',
        staffId: 't1',
        classroomId: 'r2',
        effectiveFrom: new Date('2026-05-01'),
      }),
    ).toMatch(/Teacher/);

    expect(
      detectTimetableConflict(existing, {
        dayOfWeek: 1,
        periodId: 'p1',
        sectionId: 'sec-b',
        staffId: 't2',
        classroomId: 'r1',
        effectiveFrom: new Date('2026-05-01'),
      }),
    ).toMatch(/Classroom/);

    expect(
      detectTimetableConflict(existing, {
        dayOfWeek: 2,
        periodId: 'p1',
        sectionId: 'sec-a',
        staffId: 't1',
        classroomId: 'r1',
        effectiveFrom: new Date('2026-05-01'),
      }),
    ).toBeNull();
  });

  it('should enforce exam mark upper bounds and status rules (M07-AC1)', () => {
    expect(validateMarkValue('present', 105, 100)).toMatch(/exceed maximum/);
    expect(validateMarkValue('present', 85, 100)).toBeNull();
    expect(validateMarkValue('absent', null, 100)).toBeNull();
  });

  it('should enforce payment allocation limits, credit remainder, and maker-checker refunds (M10-AC2..AC4)', () => {
    const balances = new Map([['inv-1', 500]]);
    expect(() => validatePaymentAllocation(400, [{ invoiceId: 'inv-1', amount: 450 }], balances)).toThrow();
    expect(() => validatePaymentAllocation(600, [{ invoiceId: 'inv-1', amount: 550 }], balances)).toThrow();

    expect(validatePaymentAllocation(700, [{ invoiceId: 'inv-1', amount: 500 }], balances)).toBe(200);
    expect(computeInvoiceStatus(1000, 100, 900)).toBe('paid');
    expect(computeInvoiceStatus(1000, 100, 300)).toBe('partial');
    expect(computeInvoiceStatus(1000, 100, 0)).toBe('unpaid');

    expect(() => assertDifferentApprover('user-1', 'user-1')).toThrow();
    expect(() => assertDifferentApprover('user-1', 'user-2')).not.toThrow();
  });

  it('should expose Phase 2 & 3A OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/attendance/student-bulk']).toBeDefined();
    expect(openapi.body.paths['/api/v1/timetable/entries']).toBeDefined();
    expect(openapi.body.paths['/api/v1/exams']).toBeDefined();
    expect(openapi.body.paths['/api/v1/fees/payments']).toBeDefined();

    expect((await request(app).get('/api/v1/attendance/summary')).status).toBe(401);
    expect((await request(app).get('/api/v1/timetable/entries')).status).toBe(401);
    expect((await request(app).get('/api/v1/exams')).status).toBe(401);
    expect((await request(app).get('/api/v1/fees/summary')).status).toBe(401);
  });
});
