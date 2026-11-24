import argon2 from 'argon2';
import type { AuthMeResponse, LoginInput, ResetPasswordInput } from '@school-erp/contracts';
import { env } from '../../config/env.js';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { generateOpaqueToken, hashToken } from '../../middleware/auth.js';

export interface LoginResult {
  rawSessionToken: string;
  expiresAt: Date;
  me: AuthMeResponse;
}

export async function buildAuthMe(
  userId: string,
  activeSchoolId: string | null,
  csrfToken: string,
): Promise<AuthMeResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: {
          status: 'active',
          school: { status: 'active', deletedAt: null },
        },
        include: {
          school: true,
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive || user.deletedAt !== null) {
    throw Errors.unauthorized();
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: user.isPlatformAdmin,
    },
    activeSchoolId,
    memberships: user.memberships.map((m) => {
      const roles: string[] = [];
      const perms = new Set<string>();
      for (const ur of m.userRoles) {
        if (ur.role.deletedAt !== null) continue;
        roles.push(ur.role.key);
        for (const rp of ur.role.rolePermissions) {
          perms.add(rp.permission.code);
        }
      }
      return {
        schoolId: m.schoolId,
        schoolName: m.school.name,
        schoolSlug: m.school.slug,
        roles,
        permissions: [...perms],
      };
    }),
    csrfToken,
    appMode: env.APP_MODE,
  };
}

export async function loginWithPassword(
  input: LoginInput,
  meta: { ipAddress?: string; userAgent?: string; requestId?: string },
): Promise<LoginResult> {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    include: {
      memberships: {
        where: { status: 'active', school: { status: 'active', deletedAt: null } },
      },
    },
  });

  if (!user || !user.isActive) {
    throw Errors.unauthorized('Invalid email or password');
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    throw Errors.unauthorized('Invalid email or password');
  }

  let activeSchoolId: string | null = null;
  if (input.schoolId) {
    const allowed = user.memberships.some((m) => m.schoolId === input.schoolId);
    if (!allowed) {
      throw Errors.forbidden('User is not an active member of the requested school');
    }
    activeSchoolId = input.schoolId;
  } else if (user.memberships.length > 0) {
    activeSchoolId = user.memberships[0]!.schoolId;
  } else if (!user.isPlatformAdmin) {
    throw Errors.forbidden('No active school membership');
  }

  const rawSessionToken = generateOpaqueToken(32);
  const csrfToken = generateOpaqueToken(24);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(rawSessionToken),
      csrfToken,
      userId: user.id,
      activeSchoolId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      expiresAt,
    },
  });

  await recordAuditLog({
    schoolId: activeSchoolId,
    actorUserId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    ipAddress: meta.ipAddress,
    requestId: meta.requestId,
  });

  const me = await buildAuthMe(user.id, activeSchoolId, csrfToken);
  return { rawSessionToken, expiresAt, me };
}

export async function switchActiveSchool(
  sessionId: string,
  userId: string,
  isPlatformAdmin: boolean,
  targetSchoolId: string | null,
  csrfToken: string,
): Promise<AuthMeResponse> {
  if (targetSchoolId === null) {
    if (!isPlatformAdmin) {
      throw Errors.forbidden('Only platform administrators can switch to platform mode');
    }
  } else {
    const membership = await prisma.schoolMembership.findFirst({
      where: {
        schoolId: targetSchoolId,
        userId,
        status: 'active',
        school: { status: 'active', deletedAt: null },
      },
    });
    if (!membership) {
      throw Errors.forbidden('No active membership in target school');
    }
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeSchoolId: targetSchoolId, lastSeenAt: new Date() },
  });

  return buildAuthMe(userId, targetSchoolId, csrfToken);
}

export async function revokeSession(sessionId: string, userId: string, schoolId: string | null, requestId?: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  await recordAuditLog({
    schoolId,
    actorUserId: userId,
    action: 'auth.logout',
    entityType: 'session',
    entityId: sessionId,
    requestId,
  });
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true, deletedAt: null },
  });
  if (!user) return null;

  const rawToken = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });
  return rawToken;
}

export async function resetPasswordWithToken(input: ResetPasswordInput): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
    throw Errors.badRequest('Invalid or expired password reset token');
  }

  const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
