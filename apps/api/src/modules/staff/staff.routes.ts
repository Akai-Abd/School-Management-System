import { Router } from 'express';
import {
  assignClassTeacherSchema,
  assignSubjectTeacherSchema,
  createNamedCatalogSchema,
  createStaffSchema,
  paginationQuerySchema,
  updateStaffStatusSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { nextDocumentNumber, prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';

export const staffRouter = Router();
staffRouter.use(requireAuth, requireSchoolContext, requireModule('staff'));

staffRouter.get('/catalogs', requirePermission('staff.view'), async (req, res, next) => {
  try {
    const [departments, designations] = await Promise.all([
      req.tenantPrisma!.department.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      req.tenantPrisma!.designation.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    ]);
    res.json({ departments, designations });
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/departments', requireCsrf, requirePermission('staff.create'), validateBody(createNamedCatalogSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.department.create({
      data: { schoolId: req.auth!.activeSchoolId!, name: req.body.name },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/designations', requireCsrf, requirePermission('staff.create'), validateBody(createNamedCatalogSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.designation.create({
      data: { schoolId: req.auth!.activeSchoolId!, name: req.body.name },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

staffRouter.get('/', requirePermission('staff.view'), validateQuery(paginationQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, search } = paginationQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { employeeCode: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      req.tenantPrisma!.staff.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          teacherProfile: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      req.tenantPrisma!.staff.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
});

staffRouter.get('/:id', requirePermission('staff.view'), async (req, res, next) => {
  try {
    const staff = await req.tenantPrisma!.staff.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        department: true,
        designation: true,
        teacherProfile: true,
        employmentHistory: { orderBy: { effectiveDate: 'desc' } },
      },
    });
    if (!staff) throw Errors.notFound('Staff member not found');
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/', requireCsrf, requirePermission('staff.create'), validateBody(createStaffSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const joiningDate = new Date(req.body.joiningDate);

    const created = await prisma.$transaction(async (tx) => {
      const employeeCode = await nextDocumentNumber(tx, schoolId, 'employee');
      const staff = await tx.staff.create({
        data: {
          schoolId,
          employeeCode,
          fullName: req.body.fullName,
          email: req.body.email,
          phone: req.body.phone,
          departmentId: req.body.departmentId,
          designationId: req.body.designationId,
          joiningDate,
          isTeacher: req.body.isTeacher,
          userId: req.body.userId,
        },
      });

      if (req.body.isTeacher) {
        await tx.teacherProfile.create({
          data: {
            schoolId,
            staffId: staff.id,
            qualifications: req.body.qualifications,
            experienceYears: req.body.experienceYears,
            specialization: req.body.specialization,
          },
        });
      }

      await tx.staffEmploymentHistory.create({
        data: {
          schoolId,
          staffId: staff.id,
          eventType: 'joined',
          effectiveDate: joiningDate,
          departmentId: req.body.departmentId,
          designationId: req.body.designationId,
        },
      });

      return staff;
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'staff.created',
      entityType: 'staff',
      entityId: created.id,
      metadata: { employeeCode: created.employeeCode },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

staffRouter.patch('/:id/status', requireCsrf, requirePermission('staff.update'), validateBody(updateStaffStatusSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const staffId = req.params.id;
    if (!staffId) throw Errors.badRequest('Staff ID is required');

    const existing = await req.tenantPrisma!.staff.findFirst({ where: { id: staffId, deletedAt: null } });
    if (!existing) throw Errors.notFound('Staff member not found');

    const effectiveDate = new Date(req.body.effectiveDate);

    await prisma.$transaction([
      prisma.staff.update({
        where: { id: existing.id },
        data: {
          status: req.body.status,
          ...(req.body.departmentId !== undefined ? { departmentId: req.body.departmentId } : {}),
          ...(req.body.designationId !== undefined ? { designationId: req.body.designationId } : {}),
        },
      }),
      prisma.staffEmploymentHistory.create({
        data: {
          schoolId,
          staffId: existing.id,
          eventType: `status_${req.body.status}`,
          effectiveDate,
          departmentId: req.body.departmentId ?? existing.departmentId,
          designationId: req.body.designationId ?? existing.designationId,
          notes: req.body.notes,
        },
      }),
    ]);

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'staff.status_updated',
      entityType: 'staff',
      entityId: existing.id,
      metadata: req.body,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/class-teachers', requireCsrf, requirePermission('staff.update'), validateBody(assignClassTeacherSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const [year, section, staff] = await Promise.all([
      req.tenantPrisma!.academicYear.findFirst({ where: { id: req.body.academicYearId, deletedAt: null } }),
      req.tenantPrisma!.section.findFirst({ where: { id: req.body.sectionId, deletedAt: null } }),
      req.tenantPrisma!.staff.findFirst({ where: { id: req.body.staffId, deletedAt: null } }),
    ]);
    if (!year || !section || !staff) {
      throw Errors.badRequest('Academic year, section, or staff member not found');
    }

    const created = await req.tenantPrisma!.classTeacher.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/teacher-assignments', requireCsrf, requirePermission('staff.update'), validateBody(assignSubjectTeacherSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const [year, section, subject, staff] = await Promise.all([
      req.tenantPrisma!.academicYear.findFirst({ where: { id: req.body.academicYearId, deletedAt: null } }),
      req.tenantPrisma!.section.findFirst({ where: { id: req.body.sectionId, deletedAt: null } }),
      req.tenantPrisma!.subject.findFirst({ where: { id: req.body.subjectId, deletedAt: null } }),
      req.tenantPrisma!.staff.findFirst({ where: { id: req.body.staffId, deletedAt: null } }),
    ]);
    if (!year || !section || !subject || !staff) {
      throw Errors.badRequest('Academic year, section, subject, or staff member not found');
    }

    const created = await req.tenantPrisma!.teacherAssignment.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
