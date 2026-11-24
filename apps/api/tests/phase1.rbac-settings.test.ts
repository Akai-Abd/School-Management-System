import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createRoleSchema,
  inviteUserSchema,
  updateSchoolModulesSchema,
  updateSchoolSettingsSchema,
} from '@school-erp/contracts';
import { createApp } from '../src/app.js';
import { requireModule, resolveEnabledModules } from '../src/middleware/auth.js';
import { isLoginLockedOut } from '../src/modules/auth/auth.service.js';
import { assertNoPrivilegeEscalation } from '../src/modules/rbac/rbac.routes.js';

describe('Phase 1 settings, modules, and RBAC guards', () => {
  it('should block disabled modules via requireModule and allow enabled modules', () => {
    let blockedErr: unknown;
    requireModule('fees')(
      {
        auth: {
          activeSchoolId: 's1',
          enabledModules: new Set(['students', 'staff']),
        },
      } as never,
      {} as never,
      (err) => {
        blockedErr = err;
      },
    );
    expect((blockedErr as { statusCode: number }).statusCode).toBe(403);

    let allowedErr: unknown;
    requireModule('students')(
      {
        auth: {
          activeSchoolId: 's1',
          enabledModules: new Set(['students', 'staff']),
        },
      } as never,
      {} as never,
      (err) => {
        allowedErr = err;
      },
    );
    expect(allowedErr).toBeUndefined();
  });

  it('should default all modules enabled when no school_modules rows exist and filter disabled rows', () => {
    expect(resolveEnabledModules([])).toContain('students');
    expect(
      resolveEnabledModules([
        { moduleKey: 'students', isEnabled: true },
        { moduleKey: 'fees', isEnabled: false },
      ]),
    ).toEqual(['students']);
  });

  it('should prevent privilege escalation for non-admin role editors', () => {
    expect(() =>
      assertNoPrivilegeEscalation(['teacher'], new Set(['students.view']), ['students.view', 'fees.manage']),
    ).toThrow();

    expect(() =>
      assertNoPrivilegeEscalation(['teacher'], new Set(['students.view']), ['students.view']),
    ).not.toThrow();

    expect(() =>
      assertNoPrivilegeEscalation(['school_admin'], new Set(), ['fees.manage', 'roles.manage']),
    ).not.toThrow();
  });

  it('should enforce login lockout threshold after 5 failed attempts', () => {
    expect(isLoginLockedOut(4)).toBe(false);
    expect(isLoginLockedOut(5)).toBe(true);
  });

  it('should validate Phase 1 settings and RBAC Zod schemas', () => {
    expect(updateSchoolSettingsSchema.parse({ currency: 'inr', studentFeeViewEnabled: false }).currency).toBe('INR');
    expect(() => updateSchoolModulesSchema.parse({ modules: [] })).toThrow();
    expect(() => createRoleSchema.parse({ key: 'Bad Key!', name: 'Bad' })).toThrow();
    expect(inviteUserSchema.parse({ email: 'Teacher@School.org', roleId: '00000000-0000-0000-0000-000000000000' }).email).toBe(
      'teacher@school.org',
    );
  });

  it('should expose Phase 1 OpenAPI routes and reject unauthenticated access', async () => {
    const app = createApp();

    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/settings']).toBeDefined();
    expect(openapi.body.paths['/api/v1/roles']).toBeDefined();
    expect(openapi.body.paths['/api/v1/users/invite']).toBeDefined();
    expect(openapi.body.paths['/api/v1/audit-logs']).toBeDefined();

    expect((await request(app).get('/api/v1/settings')).status).toBe(401);
    expect((await request(app).get('/api/v1/roles')).status).toBe(401);
    expect((await request(app).get('/api/v1/audit-logs')).status).toBe(401);
  });
});
