import argon2 from 'argon2';
import type { AcceptInviteInput, AuthMeResponse, LoginInput, ResetPasswordInput } from '@school-erp/contracts';
import { env } from '../../config/env.js';
import { recordAuditLog } from '../../lib/audit.js';
import { AppError, Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { buildOtpAuthUri, generateRecoveryCodes, generateTotpSecret, verifyTotpCode } from '../../lib/totp.js';
import { generateOpaqueToken, hashToken, resolveEnabledModules } from '../../middleware/auth.js';

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

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
      mfaMethods: { where: { isActive: true } },
      memberships: {
        where: {
          status: 'active',
          school: { status: 'active', deletedAt: null },
        },
        include: {
          school: {
            include: { modules: true },
          },
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
      mfaEnabled: user.mfaMethods.length > 0,
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
        enabledModules: resolveEnabledModules(m.school.modules),
      };
    }),
    csrfToken,
    appMode: env.APP_MODE,
  };
}

export function isLoginLockedOut(recentFailedCount: number): boolean {
  return recentFailedCount >= LOGIN_LOCKOUT_THRESHOLD;
}

export async function loginWithPassword(
  input: LoginInput,
  meta: { ipAddress?: string; userAgent?: string; requestId?: string },
): Promise<LoginResult> {
  const windowStart = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MS);
  const recentFailures = await prisma.loginAttempt.count({
    where: {
      email: input.email,
      succeeded: false,
      createdAt: { gte: windowStart },
    },
  });

  if (isLoginLockedOut(recentFailures)) {
    throw Errors.tooManyRequests('Too many failed login attempts. Try again in 15 minutes.');
  }

  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    include: {
      mfaMethods: { where: { isActive: true } },
      memberships: {
        where: { status: 'active', school: { status: 'active', deletedAt: null } },
      },
    },
  });

  if (!user || !user.isActive) {
    await prisma.loginAttempt.create({
      data: { email: input.email, ipAddress: meta.ipAddress, succeeded: false },
    });
    throw Errors.unauthorized('Invalid email or password');
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    await prisma.loginAttempt.create({
      data: { email: input.email, ipAddress: meta.ipAddress, succeeded: false },
    });
    throw Errors.unauthorized('Invalid email or password');
  }

  const activeMfa = user.mfaMethods[0];
  if (activeMfa) {
    if (!input.totpCode && !input.recoveryCode) {
      throw new AppError(403, 'MFA_REQUIRED', 'Multi-factor authentication code required');
    }
    if (input.totpCode) {
      if (!verifyTotpCode(activeMfa.secret, input.totpCode)) {
        throw Errors.unauthorized('Invalid authenticator code');
      }
    } else if (input.recoveryCode) {
      const codeHash = hashToken(input.recoveryCode.toUpperCase());
      const recovery = await prisma.mfaRecoveryCode.findFirst({
        where: { userId: user.id, codeHash, usedAt: null },
      });
      if (!recovery) throw Errors.unauthorized('Invalid or already used recovery code');
      await prisma.mfaRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
    }
  }

  await prisma.loginAttempt.create({
    data: { email: input.email, ipAddress: meta.ipAddress, succeeded: true },
  });

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

export async function acceptUserInvitation(input: AcceptInviteInput, requestId?: string): Promise<void> {
  const invite = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  if (!invite || invite.acceptedAt !== null || invite.expiresAt <= new Date()) {
    throw Errors.badRequest('Invalid or expired invitation token');
  }

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

  await prisma.$transaction(async (tx) => {
    let user = await tx.user.findFirst({
      where: { email: invite.email, deletedAt: null },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email: invite.email,
          fullName: input.fullName,
          passwordHash,
        },
      });
    } else if (!user.isActive) {
      throw Errors.forbidden('User account is deactivated');
    }

    const membership = await tx.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId: invite.schoolId, userId: user.id } },
      update: { status: 'active' },
      create: { schoolId: invite.schoolId, userId: user.id, status: 'active' },
    });

    await tx.userRole.upsert({
      where: { schoolMembershipId_roleId: { schoolMembershipId: membership.id, roleId: invite.roleId } },
      update: {},
      create: {
        schoolMembershipId: membership.id,
        schoolId: invite.schoolId,
        roleId: invite.roleId,
      },
    });

    await tx.userInvitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        schoolId: invite.schoolId,
        actorUserId: user.id,
        action: 'user.invite_accepted',
        entityType: 'user_invitation',
        entityId: invite.id,
        requestId: requestId ?? null,
      },
    });
  });
}

export async function setupUserMfa(userId: string, email: string) {
  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();

  await prisma.$transaction(async (tx) => {
    await tx.userMfaMethod.deleteMany({ where: { userId, isActive: false } });
    await tx.userMfaMethod.create({ data: { userId, secret, isActive: false } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId, usedAt: null } });
    await tx.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({ userId, codeHash: hashToken(code) })),
    });
  });

  return {
    secret,
    otpauthUri: buildOtpAuthUri(email, secret),
    recoveryCodes,
  };
}

export async function verifyAndEnableMfa(userId: string, code: string, schoolId: string | null, requestId?: string) {
  const pending = await prisma.userMfaMethod.findFirst({
    where: { userId, isActive: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!pending) throw Errors.badRequest('No pending MFA setup found');
  if (!verifyTotpCode(pending.secret, code)) {
    throw Errors.badRequest('Invalid authenticator code');
  }

  await prisma.$transaction([
    prisma.userMfaMethod.deleteMany({ where: { userId, isActive: true } }),
    prisma.userMfaMethod.update({
      where: { id: pending.id },
      data: { isActive: true, verifiedAt: new Date() },
    }),
  ]);

  await recordAuditLog({
    schoolId,
    actorUserId: userId,
    action: 'auth.mfa_enabled',
    entityType: 'user',
    entityId: userId,
    requestId,
  });
}
