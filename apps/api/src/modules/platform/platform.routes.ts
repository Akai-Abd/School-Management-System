import argon2 from 'argon2';
import { Router } from 'express';
import {
  CONFIGURABLE_MODULE_KEYS,
  createPlanSchema,
  createSupportGrantSchema,
  onboardSchoolSchema,
  SYSTEM_ROLE_KEYS,
  updateSchoolStatusSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requirePlatformAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export const platformRouter = Router();
platformRouter.use(requireAuth, requirePlatformAdmin);

platformRouter.get('/plans', async (_req, res, next) => {
  try {
    const items = await prisma.subscriptionPlan.findMany({ orderBy: { priceMonthlyInr: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

platformRouter.post('/plans', requireCsrf, validateBody(createPlanSchema), async (req, res, next) => {
  try {
    const created = await prisma.subscriptionPlan.create({
      data: {
        code: req.body.code,
        name: req.body.name,
        maxStudents: req.body.maxStudents,
        maxStaff: req.body.maxStaff,
        enabledModulesJson: req.body.enabledModules,
        priceMonthlyInr: req.body.priceMonthlyInr,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

platformRouter.get('/schools', async (_req, res, next) => {
  try {
    const [schools, activeGrants] = await Promise.all([
      prisma.school.findMany({
        where: { deletedAt: null },
        include: {
          subscription: { include: { plan: true } },
          _count: { select: { memberships: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supportAccessGrant.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ items: schools, activeGrants });
  } catch (err) {
    next(err);
  }
});

platformRouter.post('/schools', requireCsrf, validateBody(onboardSchoolSchema), async (req, res, next) => {
  try {
    const { name, slug, adminEmail, adminName, adminPassword, planId } = req.body;
    const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
    const allPermissions = await prisma.permission.findMany();

    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : null;
    if (planId && !plan) throw Errors.badRequest('Subscription plan not found');

    const enabledModules = plan
      ? (plan.enabledModulesJson as string[])
      : [...CONFIGURABLE_MODULE_KEYS];

    const school = await prisma.$transaction(async (tx) => {
      const createdSchool = await tx.school.create({ data: { name, slug } });
      await tx.schoolSetting.create({ data: { schoolId: createdSchool.id } });
      await tx.schoolModule.createMany({
        data: CONFIGURABLE_MODULE_KEYS.map((moduleKey) => ({
          schoolId: createdSchool.id,
          moduleKey,
          isEnabled: enabledModules.includes(moduleKey),
        })),
      });

      if (plan) {
        await tx.schoolSubscription.create({
          data: { schoolId: createdSchool.id, planId: plan.id, status: 'active' },
        });
      }

      let adminRoleId = '';
      for (const roleKey of SYSTEM_ROLE_KEYS) {
        if (roleKey === 'super_admin') continue;
        const role = await tx.role.create({
          data: {
            schoolId: createdSchool.id,
            key: roleKey,
            name: roleKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            isSystem: true,
          },
        });
        if (roleKey === 'school_admin') adminRoleId = role.id;
      }

      if (adminRoleId && allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((p) => ({
            roleId: adminRoleId,
            schoolId: createdSchool.id,
            permissionId: p.id,
          })),
        });
      }

      let user = await tx.user.findFirst({ where: { email: adminEmail, deletedAt: null } });
      if (!user) {
        user = await tx.user.create({ data: { email: adminEmail, fullName: adminName, passwordHash } });
      }
      const membership = await tx.schoolMembership.create({
        data: { schoolId: createdSchool.id, userId: user.id },
      });
      await tx.userRole.create({
        data: { schoolMembershipId: membership.id, schoolId: createdSchool.id, roleId: adminRoleId },
      });

      for (const [docType, prefix] of [
        ['admission', 'ADM-'],
        ['employee', 'EMP-'],
        ['invoice', 'INV-'],
        ['receipt', 'RCP-'],
        ['journal', 'JRN-'],
        ['tc', 'TC-'],
      ] as const) {
        await tx.documentSequence.create({
          data: { schoolId: createdSchool.id, docType, scopeKey: 'default', prefix, nextNumber: 1 },
        });
      }

      await tx.platformAuditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          schoolId: createdSchool.id,
          action: 'platform.school_onboarded',
          metadata: { slug, planId: plan?.id ?? null },
        },
      });

      return createdSchool;
    });

    res.status(201).json(school);
  } catch (err) {
    next(err);
  }
});

platformRouter.patch('/schools/:id/status', requireCsrf, validateBody(updateSchoolStatusSchema), async (req, res, next) => {
  try {
    const schoolId = req.params.id;
    if (!schoolId) throw Errors.badRequest('School ID is required');
    await prisma.$transaction([
      prisma.school.update({ where: { id: schoolId }, data: { status: req.body.status } }),
      prisma.platformAuditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          schoolId,
          action: 'platform.school_status_updated',
          metadata: { status: req.body.status },
        },
      }),
    ]);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

/** Break-glass audited support access grant visible to the school's administrators (§4.1). */
platformRouter.post('/schools/:id/support-grant', requireCsrf, validateBody(createSupportGrantSchema), async (req, res, next) => {
  try {
    const schoolId = req.params.id;
    if (!schoolId) throw Errors.badRequest('School ID is required');

    const expiresAt = new Date(Date.now() + req.body.durationMinutes * 60_000);
    const grant = await prisma.$transaction(async (tx) => {
      const created = await tx.supportAccessGrant.create({
        data: {
          schoolId,
          platformUserId: req.auth!.userId,
          reason: req.body.reason,
          expiresAt,
        },
      });
      await tx.platformAuditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          schoolId,
          action: 'platform.support_access_granted',
          metadata: { grantId: created.id, reason: req.body.reason, expiresAt },
        },
      });
      return created;
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'platform.support_access_granted',
      entityType: 'support_access_grant',
      entityId: grant.id,
      metadata: { reason: req.body.reason, expiresAt },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(grant);
  } catch (err) {
    next(err);
  }
});

platformRouter.get('/audit-logs', async (_req, res, next) => {
  try {
    const items = await prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});
