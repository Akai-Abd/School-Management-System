import { Router } from 'express';
import {
  paginationQuerySchema,
  updateDocumentSequenceSchema,
  updateSchoolModulesSchema,
  updateSchoolSettingsSchema,
  verifyLicenseSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { verifyOfflineLicense } from '../../lib/license.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requirePermission, requireSchoolContext, resolveEnabledModules } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireSchoolContext);

settingsRouter.get('/', requirePermission('schools.view'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const [school, settings, moduleRows, sequences] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      req.tenantPrisma!.schoolSetting.findFirst({ where: { schoolId } }),
      req.tenantPrisma!.schoolModule.findMany({ where: { schoolId }, orderBy: { moduleKey: 'asc' } }),
      req.tenantPrisma!.documentSequence.findMany({ where: { schoolId }, orderBy: { docType: 'asc' } }),
    ]);

    if (!school) throw Errors.notFound('School not found');

    const enabledSet = new Set(resolveEnabledModules(moduleRows));
    const modules =
      moduleRows.length > 0
        ? moduleRows.map((m) => ({ moduleKey: m.moduleKey, isEnabled: m.isEnabled }))
        : [...enabledSet].map((moduleKey) => ({ moduleKey, isEnabled: true }));

    res.json({
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        status: school.status,
        timezone: school.timezone,
        currency: school.currency,
      },
      settings: settings ?? {
        locale: 'en-IN',
        dateFormat: 'DD/MM/YYYY',
        workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        roundingPolicy: 'per_line_half_up',
        studentFeeViewEnabled: false,
        discountApprovalAmount: null,
      },
      modules,
      sequences,
    });
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/', requireCsrf, requirePermission('schools.update'), validateBody(updateSchoolSettingsSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { name, timezone, currency, ...settingFields } = req.body;

    await prisma.$transaction(async (tx) => {
      if (name !== undefined || timezone !== undefined || currency !== undefined) {
        await tx.school.update({
          where: { id: schoolId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(timezone !== undefined ? { timezone } : {}),
            ...(currency !== undefined ? { currency } : {}),
          },
        });
      }

      if (Object.keys(settingFields).length > 0) {
        await tx.schoolSetting.upsert({
          where: { schoolId },
          update: settingFields,
          create: { schoolId, ...settingFields },
        });
      }
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'school.settings_updated',
      entityType: 'school',
      entityId: schoolId,
      metadata: req.body,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

settingsRouter.put('/modules', requireCsrf, requirePermission('schools.manage'), validateBody(updateSchoolModulesSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { modules } = req.body;

    await prisma.$transaction(
      modules.map((item: { moduleKey: string; isEnabled: boolean }) =>
        prisma.schoolModule.upsert({
          where: { schoolId_moduleKey: { schoolId, moduleKey: item.moduleKey } },
          update: { isEnabled: item.isEnabled },
          create: { schoolId, moduleKey: item.moduleKey, isEnabled: item.isEnabled },
        }),
      ),
    );

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'school.modules_updated',
      entityType: 'school_module',
      entityId: schoolId,
      metadata: { modules },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ modules });
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/sequences/:docType', requireCsrf, requirePermission('schools.manage'), validateBody(updateDocumentSequenceSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const docType = req.params.docType;
    if (!docType) throw Errors.badRequest('Document type is required');
    const { prefix, scopeKey } = req.body;

    const updated = await prisma.documentSequence.upsert({
      where: { schoolId_docType_scopeKey: { schoolId, docType, scopeKey } },
      update: { prefix },
      create: { schoolId, docType, scopeKey, prefix, nextNumber: 1 },
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'sequence.updated',
      entityType: 'document_sequence',
      entityId: updated.id,
      metadata: { docType, scopeKey, prefix },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** Exports full school data package for standalone migration or offboarding (M18-AC4/AC5). */
settingsRouter.get('/export.json', requirePermission('schools.export'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const db = req.tenantPrisma!;
    const [
      school,
      settings,
      modules,
      academicYears,
      classes,
      subjects,
      staff,
      students,
      guardians,
      enrollments,
      invoices,
      payments,
      financialEvents,
    ] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      db.schoolSetting.findFirst({}),
      db.schoolModule.findMany({}),
      db.academicYear.findMany({ include: { terms: true } }),
      db.schoolClass.findMany({ include: { sections: true } }),
      db.subject.findMany({}),
      db.staff.findMany({ include: { teacherProfile: true, employmentHistory: true } }),
      db.student.findMany({ include: { guardians: true } }),
      db.guardian.findMany({}),
      db.studentEnrollment.findMany({}),
      db.invoice.findMany({ include: { items: true } }),
      db.payment.findMany({ include: { allocations: true } }),
      db.financialEvent.findMany({}),
    ]);

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'school.full_export',
      entityType: 'school',
      entityId: schoolId,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.setHeader('Content-Disposition', `attachment; filename="school-export-${school?.slug ?? schoolId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      school,
      settings,
      modules,
      academicYears,
      classes,
      subjects,
      staff,
      students,
      guardians,
      enrollments,
      invoices,
      payments,
      financialEvents,
    });
  } catch (err) {
    next(err);
  }
});

settingsRouter.post('/license/verify', requireCsrf, requirePermission('schools.manage'), validateBody(verifyLicenseSchema), async (req, res, next) => {
  try {
    const result = verifyOfflineLicense(req.body.payload, req.body.signature);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const auditLogsRouter = Router();
auditLogsRouter.use(requireAuth, requireSchoolContext);

auditLogsRouter.get('/', requirePermission('audit_logs.view'), validateQuery(paginationQuerySchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { page, limit, search, sortOrder } = paginationQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' as const } },
              { entityType: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
});
