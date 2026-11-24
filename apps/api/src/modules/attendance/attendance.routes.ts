import { Router } from 'express';
import {
  bulkStudentAttendanceSchema,
  correctAttendanceSchema,
  createLeaveRequestSchema,
  reviewLeaveSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth, requireSchoolContext, requireModule('attendance'));

attendanceRouter.get('/sessions', requirePermission('attendance.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.attendanceSession.findMany({
      include: { records: true },
      orderBy: { attendanceDate: 'desc' },
      take: 30,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

attendanceRouter.post('/student-bulk', requireCsrf, requirePermission('attendance.create'), validateBody(bulkStudentAttendanceSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { academicYearId, sectionId, attendanceDate, periodNumber, entries } = req.body;
    const dateObj = new Date(attendanceDate);

    const section = await req.tenantPrisma!.section.findFirst({ where: { id: sectionId, deletedAt: null } });
    if (!section) throw Errors.badRequest('Section not found in active school');

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.upsert({
        where: {
          schoolId_sectionId_attendanceDate_periodNumber: {
            schoolId,
            sectionId,
            attendanceDate: dateObj,
            periodNumber,
          },
        },
        update: { markedByUserId: req.auth!.userId },
        create: {
          schoolId,
          academicYearId,
          sectionId,
          attendanceDate: dateObj,
          periodNumber,
          markedByUserId: req.auth!.userId,
        },
      });

      for (const entry of entries) {
        await tx.studentAttendance.upsert({
          where: {
            schoolId_sessionId_studentId: {
              schoolId,
              sessionId: session.id,
              studentId: entry.studentId,
            },
          },
          update: { status: entry.status, remarks: entry.remarks },
          create: {
            schoolId,
            sessionId: session.id,
            studentId: entry.studentId,
            status: entry.status,
            remarks: entry.remarks,
          },
        });
      }

      return session;
    });

    res.status(201).json({ sessionId: result.id, count: entries.length });
  } catch (err) {
    next(err);
  }
});

attendanceRouter.patch('/student/:recordId', requireCsrf, requirePermission('attendance.update'), validateBody(correctAttendanceSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const recordId = req.params.recordId;
    if (!recordId) throw Errors.badRequest('Record ID is required');

    const existing = await req.tenantPrisma!.studentAttendance.findFirst({ where: { id: recordId } });
    if (!existing) throw Errors.notFound('Attendance record not found');

    await prisma.studentAttendance.update({
      where: { id: existing.id },
      data: { status: req.body.status },
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'attendance.corrected',
      entityType: 'student_attendance',
      entityId: existing.id,
      metadata: { from: existing.status, to: req.body.status, reason: req.body.reason },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get('/summary', requirePermission('attendance.view'), async (req, res, next) => {
  try {
    const records = await req.tenantPrisma!.studentAttendance.findMany();
    const byStudent = new Map<string, { total: number; present: number }>();
    for (const r of records) {
      const curr = byStudent.get(r.studentId) ?? { total: 0, present: 0 };
      curr.total += 1;
      if (r.status === 'present' || r.status === 'late') curr.present += 1;
      byStudent.set(r.studentId, curr);
    }
    const items = [...byStudent.entries()].map(([studentId, s]) => ({
      studentId,
      totalDays: s.total,
      presentDays: s.present,
      percentage: s.total ? Math.round((s.present / s.total) * 1000) / 10 : 0,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get('/leaves', requirePermission('attendance.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.leaveRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

attendanceRouter.post('/leaves', requireCsrf, requirePermission('attendance.create'), validateBody(createLeaveRequestSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (startDate > endDate) throw Errors.badRequest('Leave start date cannot be after end date');

    const created = await req.tenantPrisma!.leaveRequest.create({
      data: {
        schoolId,
        applicantType: req.body.applicantType,
        studentId: req.body.studentId,
        staffId: req.body.staffId,
        startDate,
        endDate,
        reason: req.body.reason,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

attendanceRouter.patch('/leaves/:id/review', requireCsrf, requirePermission('attendance.approve'), validateBody(reviewLeaveSchema), async (req, res, next) => {
  try {
    const leaveId = req.params.id;
    if (!leaveId) throw Errors.badRequest('Leave request ID is required');
    const leave = await req.tenantPrisma!.leaveRequest.findFirst({ where: { id: leaveId } });
    if (!leave) throw Errors.notFound('Leave request not found');

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: req.body.decision,
        reviewedByUserId: req.auth!.userId,
        reviewNotes: req.body.reviewNotes,
      },
    });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});
