import { Router } from 'express';
import {
  assignClassSubjectSchema,
  createAcademicTermSchema,
  createAcademicYearSchema,
  createCalendarEventSchema,
  createClassSchema,
  createSectionSchema,
  createSubjectGroupSchema,
  createSubjectSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function hasOverlappingDateRange(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA <= endB && startB <= endA;
}

export function validateTermAgainstYear(
  termStart: Date,
  termEnd: Date,
  yearStart: Date,
  yearEnd: Date,
  existingTerms: Array<{ startDate: Date; endDate: Date; name: string }>,
): string | null {
  if (termStart >= termEnd) return 'Term start date must be before end date';
  if (termStart < yearStart || termEnd > yearEnd) {
    return 'Term dates must fall within the academic year range';
  }
  const conflict = existingTerms.find((t) => hasOverlappingDateRange(termStart, termEnd, t.startDate, t.endDate));
  if (conflict) return `Term dates overlap with existing term '${conflict.name}'`;
  return null;
}

export const academicRouter = Router();
academicRouter.use(requireAuth, requireSchoolContext, requireModule('academic'));

academicRouter.get('/years', requirePermission('academic.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.academicYear.findMany({
      where: { deletedAt: null },
      include: { terms: { orderBy: { startDate: 'asc' } } },
      orderBy: { startDate: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/years', requireCsrf, requirePermission('academic.create'), validateBody(createAcademicYearSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (startDate >= endDate) throw Errors.badRequest('Academic year start date must be before end date');

    const created = await prisma.$transaction(async (tx) => {
      if (req.body.isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId, isCurrent: true, deletedAt: null },
          data: { isCurrent: false },
        });
      }
      return tx.academicYear.create({
        data: {
          schoolId,
          name: req.body.name,
          startDate,
          endDate,
          isCurrent: req.body.isCurrent,
        },
      });
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'academic_year.created',
      entityType: 'academic_year',
      entityId: created.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.patch('/years/:id/current', requireCsrf, requirePermission('academic.update'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const yearId = req.params.id;
    if (!yearId) throw Errors.badRequest('Academic year ID is required');

    const year = await req.tenantPrisma!.academicYear.findFirst({ where: { id: yearId, deletedAt: null } });
    if (!year) throw Errors.notFound('Academic year not found');

    await prisma.$transaction([
      prisma.academicYear.updateMany({ where: { schoolId, isCurrent: true, deletedAt: null }, data: { isCurrent: false } }),
      prisma.academicYear.update({ where: { id: year.id }, data: { isCurrent: true } }),
    ]);

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/terms', requireCsrf, requirePermission('academic.create'), validateBody(createAcademicTermSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const year = await req.tenantPrisma!.academicYear.findFirst({
      where: { id: req.body.academicYearId, deletedAt: null },
      include: { terms: true },
    });
    if (!year) throw Errors.notFound('Academic year not found');

    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    const errorMsg = validateTermAgainstYear(startDate, endDate, year.startDate, year.endDate, year.terms);
    if (errorMsg) throw Errors.badRequest(errorMsg);

    const created = await req.tenantPrisma!.academicTerm.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: req.body.name,
        startDate,
        endDate,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.get('/calendar', requirePermission('academic.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.calendarEvent.findMany({ orderBy: { startDate: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/calendar', requireCsrf, requirePermission('academic.create'), validateBody(createCalendarEventSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const year = await req.tenantPrisma!.academicYear.findFirst({
      where: { id: req.body.academicYearId, deletedAt: null },
    });
    if (!year) throw Errors.notFound('Academic year not found');

    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (startDate > endDate) throw Errors.badRequest('Event start date cannot be after end date');

    const created = await req.tenantPrisma!.calendarEvent.create({
      data: {
        schoolId,
        academicYearId: year.id,
        title: req.body.title,
        eventType: req.body.eventType,
        startDate,
        endDate,
        description: req.body.description,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.get('/classes', requirePermission('academic.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.schoolClass.findMany({
      where: { deletedAt: null },
      include: {
        sections: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/classes', requireCsrf, requirePermission('academic.create'), validateBody(createClassSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const created = await req.tenantPrisma!.schoolClass.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/sections', requireCsrf, requirePermission('academic.create'), validateBody(createSectionSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const cls = await req.tenantPrisma!.schoolClass.findFirst({
      where: { id: req.body.classId, deletedAt: null },
    });
    if (!cls) throw Errors.notFound('Class not found');

    const created = await req.tenantPrisma!.section.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.get('/subjects', requirePermission('academic.view'), async (req, res, next) => {
  try {
    const [subjects, classSubjects, subjectGroups] = await Promise.all([
      req.tenantPrisma!.subject.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      req.tenantPrisma!.classSubject.findMany({
        include: {
          subject: true,
          schoolClass: { select: { id: true, name: true } },
          subjectGroup: { select: { id: true, name: true } },
        },
      }),
      req.tenantPrisma!.subjectGroup.findMany({ orderBy: { name: 'asc' } }),
    ]);
    res.json({ items: subjects, classSubjects, subjectGroups });
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/subjects', requireCsrf, requirePermission('academic.create'), validateBody(createSubjectSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const created = await req.tenantPrisma!.subject.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/subject-groups', requireCsrf, requirePermission('academic.create'), validateBody(createSubjectGroupSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    if (req.body.minSelect > req.body.maxSelect) {
      throw Errors.badRequest('minSelect cannot exceed maxSelect');
    }
    const created = await req.tenantPrisma!.subjectGroup.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/class-subjects', requireCsrf, requirePermission('academic.create'), validateBody(assignClassSubjectSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const [year, cls, subject] = await Promise.all([
      req.tenantPrisma!.academicYear.findFirst({ where: { id: req.body.academicYearId, deletedAt: null } }),
      req.tenantPrisma!.schoolClass.findFirst({ where: { id: req.body.classId, deletedAt: null } }),
      req.tenantPrisma!.subject.findFirst({ where: { id: req.body.subjectId, deletedAt: null } }),
    ]);
    if (!year || !cls || !subject) {
      throw Errors.badRequest('Academic year, class, or subject not found in active school');
    }

    const created = await req.tenantPrisma!.classSubject.create({
      data: { schoolId, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
