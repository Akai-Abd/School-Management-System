import { Router } from 'express';
import {
  createClassroomSchema,
  createPeriodSchema,
  createTimetableEntrySchema,
} from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export interface TimetableSlotCandidate {
  dayOfWeek: number;
  periodId: string;
  sectionId: string;
  staffId: string;
  classroomId?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export function detectTimetableConflict(
  existing: TimetableSlotCandidate[],
  candidate: TimetableSlotCandidate,
): string | null {
  const cEnd = candidate.effectiveTo ?? new Date('9999-12-31');
  for (const row of existing) {
    if (row.dayOfWeek !== candidate.dayOfWeek || row.periodId !== candidate.periodId) continue;
    const rEnd = row.effectiveTo ?? new Date('9999-12-31');
    const datesOverlap = row.effectiveFrom <= cEnd && candidate.effectiveFrom <= rEnd;
    if (!datesOverlap) continue;

    if (row.sectionId === candidate.sectionId) return 'Section already has a lesson in this period';
    if (row.staffId === candidate.staffId) return 'Teacher is already assigned to another class in this period';
    if (candidate.classroomId && row.classroomId === candidate.classroomId) {
      return 'Classroom is already allocated in this period';
    }
  }
  return null;
}

export const timetableRouter = Router();
timetableRouter.use(requireAuth, requireSchoolContext, requireModule('timetable'));

timetableRouter.get('/periods', requirePermission('timetable.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.timetablePeriod.findMany({ orderBy: { periodNumber: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

timetableRouter.post('/periods', requireCsrf, requirePermission('timetable.create'), validateBody(createPeriodSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.timetablePeriod.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

timetableRouter.get('/classrooms', requirePermission('timetable.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.classroom.findMany({ orderBy: { name: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

timetableRouter.post('/classrooms', requireCsrf, requirePermission('timetable.create'), validateBody(createClassroomSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.classroom.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

timetableRouter.get('/entries', requirePermission('timetable.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.timetableEntry.findMany({
      include: { period: true, classroom: true },
      orderBy: [{ dayOfWeek: 'asc' }],
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

timetableRouter.post('/entries', requireCsrf, requirePermission('timetable.create'), validateBody(createTimetableEntrySchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const effectiveFrom = new Date(req.body.effectiveFrom);
    const effectiveTo = req.body.effectiveTo ? new Date(req.body.effectiveTo) : null;

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.timetableEntry.findMany({
        where: { schoolId, academicYearId: req.body.academicYearId, dayOfWeek: req.body.dayOfWeek, periodId: req.body.periodId },
      });
      const conflict = detectTimetableConflict(existing, {
        dayOfWeek: req.body.dayOfWeek,
        periodId: req.body.periodId,
        sectionId: req.body.sectionId,
        staffId: req.body.staffId,
        classroomId: req.body.classroomId,
        effectiveFrom,
        effectiveTo,
      });
      if (conflict) throw Errors.conflict(conflict);

      return tx.timetableEntry.create({
        data: {
          schoolId,
          academicYearId: req.body.academicYearId,
          sectionId: req.body.sectionId,
          periodId: req.body.periodId,
          dayOfWeek: req.body.dayOfWeek,
          subjectId: req.body.subjectId,
          staffId: req.body.staffId,
          classroomId: req.body.classroomId,
          effectiveFrom,
          effectiveTo,
        },
      });
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
