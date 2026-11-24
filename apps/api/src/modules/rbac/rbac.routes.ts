import { Router } from 'express';
import {
  createRoleSchema,
  inviteUserSchema,
  paginationQuerySchema,
  updateRoleSchema,
  updateUserRolesSchema,
} from '@school-erp/contracts';
import { env } from '../../config/env.js';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  generateOpaqueToken,
  hashToken,
  requireAuth,
  requireCsrf,
  requirePermission,
  requireSchoolContext,
} from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';

/** Prevents privilege escalation: non-admins cannot grant permissions they do not hold. */
export function assertNoPrivilegeEscalation(
  actorRoles: string[],
  actorPermissions: Set<string>,
  requestedPermissionCodes: string[],
): void {
  if (actorRoles.includes('school_admin')) return;
  const disallowed = requestedPermissionCodes.filter((code) => !actorPermissions.has(code));
  if (disallowed.length > 0) {
    throw Errors.forbidden(`Cannot grant permissions you do not hold: ${disallowed.join(', ')}`);
  }
}

export const rbacRouter = Router();
rbacRouter.use(requireAuth, requireSchoolContext);

rbacRouter.get('/permissions', requirePermission('roles.view'), async (_req, res, next) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
    res.json({ items: permissions });
  } catch (err) {
    next(err);
  }
});

rbacRouter.get('/roles', requirePermission('roles.view'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const roles = await prisma.role.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        rolePermissions: {
          include: { permission: { select: { code: true } } },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    res.json({
      items: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isSystem: r.isSystem,
        permissionCodes: r.rolePermissions.map((rp) => rp.permission.code),
      })),
    });
  } catch (err) {
    next(err);
  }
});

rbacRouter.post('/roles', requireCsrf, requirePermission('roles.create'), validateBody(createRoleSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { key, name, permissionCodes } = req.body;

    assertNoPrivilegeEscalation(req.auth!.roles, req.auth!.permissions, permissionCodes);

    const existing = await prisma.role.findFirst({
      where: { schoolId, key: key.toLowerCase(), deletedAt: null },
    });
    if (existing) throw Errors.conflict(`Role key '${key}' already exists`);

    const perms = permissionCodes.length
      ? await prisma.permission.findMany({ where: { code: { in: permissionCodes } } })
      : [];
    if (perms.length !== new Set(permissionCodes).size) {
      throw Errors.badRequest('One or more permission codes are invalid');
    }

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { schoolId, key: key.toLowerCase(), name, isSystem: false },
      });
      if (perms.length > 0) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, schoolId, permissionId: p.id })),
        });
      }
      return role;
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'role.created',
      entityType: 'role',
      entityId: created.id,
      metadata: { key: created.key, permissionCodes },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json({ ...created, permissionCodes });
  } catch (err) {
    next(err);
  }
});

rbacRouter.patch('/roles/:id', requireCsrf, requirePermission('roles.update'), validateBody(updateRoleSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const roleId = req.params.id;
    if (!roleId) throw Errors.badRequest('Role ID is required');
    const role = await prisma.role.findFirst({
      where: { id: roleId, schoolId, deletedAt: null },
    });
    if (!role) throw Errors.notFound('Role not found');
    if (role.key === 'school_admin') {
      throw Errors.forbidden('School Administrator role permissions cannot be restricted');
    }

    const { name, permissionCodes } = req.body;
    if (permissionCodes) {
      assertNoPrivilegeEscalation(req.auth!.roles, req.auth!.permissions, permissionCodes);
    }

    const perms = permissionCodes
      ? await prisma.permission.findMany({ where: { code: { in: permissionCodes } } })
      : undefined;
    if (permissionCodes && perms && perms.length !== new Set(permissionCodes).size) {
      throw Errors.badRequest('One or more permission codes are invalid');
    }

    await prisma.$transaction(async (tx) => {
      if (name !== undefined) {
        await tx.role.update({ where: { id: role.id }, data: { name } });
      }
      if (perms) {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id, schoolId } });
        if (perms.length > 0) {
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: role.id, schoolId, permissionId: p.id })),
          });
        }
      }
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'role.updated',
      entityType: 'role',
      entityId: role.id,
      metadata: req.body,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

rbacRouter.get('/users', requirePermission('users.view'), validateQuery(paginationQuerySchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { page, limit, search } = paginationQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      user: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    };

    const [memberships, total, pendingInvites] = await Promise.all([
      prisma.schoolMembership.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true, isActive: true } },
          userRoles: { include: { role: { select: { id: true, key: true, name: true } } } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.schoolMembership.count({ where }),
      prisma.userInvitation.findMany({
        where: { schoolId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      items: memberships.map((m) => ({
        membershipId: m.id,
        status: m.status,
        user: m.user,
        roles: m.userRoles.map((ur) => ur.role),
      })),
      pendingInvites: pendingInvites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        roleId: inv.roleId,
        expiresAt: inv.expiresAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

rbacRouter.post('/users/invite', requireCsrf, requirePermission('users.create'), validateBody(inviteUserSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { email, roleId } = req.body;

    const role = await prisma.role.findFirst({
      where: { id: roleId, schoolId, deletedAt: null },
      include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
    });
    if (!role) throw Errors.badRequest('Invalid role for this school');

    assertNoPrivilegeEscalation(
      req.auth!.roles,
      req.auth!.permissions,
      role.rolePermissions.map((rp) => rp.permission.code),
    );

    const rawToken = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.userInvitation.create({
      data: {
        schoolId,
        email,
        roleId: role.id,
        tokenHash: hashToken(rawToken),
        invitedByUserId: req.auth!.userId,
        expiresAt,
      },
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'user.invited',
      entityType: 'user_invitation',
      entityId: invite.id,
      metadata: { email, roleId: role.id },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json({
      id: invite.id,
      email: invite.email,
      roleId: invite.roleId,
      expiresAt: invite.expiresAt,
      ...(env.NODE_ENV !== 'production' ? { devInviteToken: rawToken } : {}),
    });
  } catch (err) {
    next(err);
  }
});

rbacRouter.patch('/users/:membershipId/roles', requireCsrf, requirePermission('users.update'), validateBody(updateUserRolesSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const membershipId = req.params.membershipId;
    if (!membershipId) throw Errors.badRequest('Membership ID is required');
    const membership = await prisma.schoolMembership.findFirst({
      where: { id: membershipId, schoolId },
    });
    if (!membership) throw Errors.notFound('School membership not found');

    const { roleIds, status } = req.body;
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds }, schoolId, deletedAt: null },
      include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw Errors.badRequest('One or more roles are invalid for this school');
    }

    const grantedPerms = roles.flatMap((r) => r.rolePermissions.map((rp) => rp.permission.code));
    assertNoPrivilegeEscalation(req.auth!.roles, req.auth!.permissions, grantedPerms);

    await prisma.$transaction(async (tx) => {
      if (status) {
        await tx.schoolMembership.update({ where: { id: membership.id }, data: { status } });
      }
      await tx.userRole.deleteMany({ where: { schoolMembershipId: membership.id, schoolId } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ schoolMembershipId: membership.id, schoolId, roleId: r.id })),
      });
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'user.roles_updated',
      entityType: 'school_membership',
      entityId: membership.id,
      metadata: { roleIds, status },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});
