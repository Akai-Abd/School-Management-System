import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CONFIGURABLE_MODULE_KEYS, type ConfigurableModuleKey } from '@school-erp/contracts';
import { env } from '../config/env.js';
import { Errors } from '../lib/errors.js';
import { forTenant, prisma } from '../lib/prisma.js';

export function resolveEnabledModules(rows: Array<{ moduleKey: string; isEnabled: boolean }>): string[] {
  if (rows.length === 0) return [...CONFIGURABLE_MODULE_KEYS];
  return rows.filter((r) => r.isEnabled).map((r) => r.moduleKey);
}

export const SESSION_COOKIE_NAME = 'school_erp_sid';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const rawSid = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawSid || typeof rawSid !== 'string') {
    return next(Errors.unauthorized());
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawSid) },
    include: {
      user: true,
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date() ||
    !session.user.isActive ||
    session.user.deletedAt !== null
  ) {
    return next(Errors.unauthorized('Session expired or invalid'));
  }

  const permissions = new Set<string>();
  const roles: string[] = [];
  const enabledModules = new Set<string>();

  if (session.activeSchoolId) {
    const membership = await prisma.schoolMembership.findUnique({
      where: {
        schoolId_userId: {
          schoolId: session.activeSchoolId,
          userId: session.userId,
        },
      },
      include: {
        school: {
          include: {
            modules: true,
          },
        },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (
      !membership ||
      membership.status !== 'active' ||
      membership.school.status !== 'active' ||
      membership.school.deletedAt !== null
    ) {
      return next(Errors.forbidden('No active membership for selected school'));
    }

    for (const modKey of resolveEnabledModules(membership.school.modules)) {
      enabledModules.add(modKey);
    }

    for (const ur of membership.userRoles) {
      if (ur.role.deletedAt !== null) continue;
      roles.push(ur.role.key);
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }
  }

  req.auth = {
    sessionId: session.id,
    userId: session.userId,
    email: session.user.email,
    fullName: session.user.fullName,
    isPlatformAdmin: session.user.isPlatformAdmin,
    activeSchoolId: session.activeSchoolId,
    csrfToken: session.csrfToken,
    permissions,
    roles,
    enabledModules,
  };

  next();
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }
  if (!req.auth) {
    return next(Errors.unauthorized());
  }

  const origin = req.header('origin');
  if (origin && origin !== env.APP_ORIGIN) {
    return next(Errors.forbidden('Invalid request origin'));
  }

  const headerToken = req.header('x-csrf-token');
  if (!headerToken || !safeEqual(headerToken, req.auth.csrfToken)) {
    return next(Errors.forbidden('Invalid or missing CSRF token'));
  }

  next();
}

export function requireSchoolContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthorized());
  if (!req.auth.activeSchoolId) {
    return next(Errors.forbidden('Active school context is required'));
  }
  req.tenantPrisma = forTenant(req.auth.activeSchoolId);
  next();
}

export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    if (!req.auth.activeSchoolId) return next(Errors.forbidden('School context required'));
    if (req.auth.roles.includes('school_admin') || req.auth.permissions.has(permissionCode)) {
      return next();
    }
    return next(Errors.forbidden(`Missing permission: ${permissionCode}`));
  };
}

/** Rejects requests to a school module that has been disabled in school_modules (M01-AC5). */
export function requireModule(moduleKey: ConfigurableModuleKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    if (!req.auth.activeSchoolId) return next(Errors.forbidden('School context required'));
    if (!req.auth.enabledModules.has(moduleKey)) {
      return next(Errors.forbidden(`Module '${moduleKey}' is disabled for this school`));
    }
    return next();
  };
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthorized());
  if (env.APP_MODE !== 'saas') {
    return next(Errors.notFound('Platform routes are disabled in standalone mode'));
  }
  if (!req.auth.isPlatformAdmin) {
    return next(Errors.forbidden('Platform administrator privileges required'));
  }
  next();
}
