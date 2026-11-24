import { Router } from 'express';
import { addExamSubjectSchema, createExamSchema, enterMarksSchema } from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { buildReportCardPdf } from '../../lib/pdf.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function validateMarkValue(
  status: 'present' | 'absent' | 'exempt' | 'withheld',
  marksObtained: number | null | undefined,
  maxMarks: number,
): string | null {
  if (status === 'present') {
    if (marksObtained === null || marksObtained === undefined) return 'Marks are required when status is present';
    if (marksObtained < 0 || marksObtained > maxMarks) return `Marks cannot exceed maximum (${maxMarks})`;
  }
  return null;
}

export const examsRouter = Router();
examsRouter.use(requireAuth, requireSchoolContext, requireModule('exams'));

examsRouter.get('/', requirePermission('exams.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.exam.findMany({
      include: { examSubjects: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

examsRouter.post('/', requireCsrf, requirePermission('exams.create'), validateBody(createExamSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.exam.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

examsRouter.post('/:examId/subjects', requireCsrf, requirePermission('exams.create'), validateBody(addExamSubjectSchema), async (req, res, next) => {
  try {
    const examId = req.params.examId;
    if (!examId) throw Errors.badRequest('Exam ID is required');
    const exam = await req.tenantPrisma!.exam.findFirst({ where: { id: examId } });
    if (!exam) throw Errors.notFound('Exam not found');
    if (req.body.passingMarks > req.body.maxMarks) {
      throw Errors.badRequest('passingMarks cannot exceed maxMarks');
    }

    const created = await req.tenantPrisma!.examSubject.create({
      data: {
        schoolId: req.auth!.activeSchoolId!,
        examId: exam.id,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        examDate: req.body.examDate ? new Date(req.body.examDate) : undefined,
        maxMarks: req.body.maxMarks,
        passingMarks: req.body.passingMarks,
        weightagePct: req.body.weightagePct,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

examsRouter.post('/subjects/:examSubjectId/marks', requireCsrf, requirePermission('exams.update'), validateBody(enterMarksSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const examSubjectId = req.params.examSubjectId;
    if (!examSubjectId) throw Errors.badRequest('Exam subject ID is required');

    const examSubject = await req.tenantPrisma!.examSubject.findFirst({
      where: { id: examSubjectId },
      include: { exam: true },
    });
    if (!examSubject) throw Errors.notFound('Exam subject not found');

    const maxMarks = Number(examSubject.maxMarks);
    for (const entry of req.body.entries) {
      const err = validateMarkValue(entry.status, entry.marksObtained, maxMarks);
      if (err) throw Errors.badRequest(err);
    }

    if (examSubject.exam.isPublished && !req.body.revisionReason) {
      throw Errors.badRequest('Published results require a revisionReason for corrections');
    }

    await prisma.$transaction(async (tx) => {
      for (const entry of req.body.entries) {
        const existing = await tx.mark.findUnique({
          where: {
            schoolId_examSubjectId_studentId: {
              schoolId,
              examSubjectId: examSubject.id,
              studentId: entry.studentId,
            },
          },
        });

        const nextMarks = entry.status === 'present' ? entry.marksObtained : null;
        if (existing) {
          await tx.mark.update({
            where: { id: existing.id },
            data: {
              status: entry.status,
              marksObtained: nextMarks,
              remarks: entry.remarks,
              version: { increment: 1 },
            },
          });

          if (examSubject.exam.isPublished) {
            await tx.markRevision.create({
              data: {
                schoolId,
                markId: existing.id,
                previousMarks: existing.marksObtained,
                newMarks: nextMarks,
                reason: req.body.revisionReason!,
                requestedByUserId: req.auth!.userId,
                approvedByUserId: req.auth!.userId,
              },
            });
          }
        } else {
          await tx.mark.create({
            data: {
              schoolId,
              examSubjectId: examSubject.id,
              studentId: entry.studentId,
              status: entry.status,
              marksObtained: nextMarks,
              remarks: entry.remarks,
            },
          });
        }
      }
    });

    if (examSubject.exam.isPublished) {
      await recordAuditLog({
        schoolId,
        actorUserId: req.auth!.userId,
        action: 'exam.marks_revised',
        entityType: 'exam_subject',
        entityId: examSubject.id,
        metadata: { reason: req.body.revisionReason, count: req.body.entries.length },
        ipAddress: req.ip,
        requestId: req.requestId,
      });
    }

    res.json({ saved: req.body.entries.length });
  } catch (err) {
    next(err);
  }
});

examsRouter.post('/:examId/publish', requireCsrf, requirePermission('exams.publish'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const examId = req.params.examId;
    if (!examId) throw Errors.badRequest('Exam ID is required');
    const exam = await req.tenantPrisma!.exam.findFirst({ where: { id: examId } });
    if (!exam) throw Errors.notFound('Exam not found');

    await prisma.exam.update({
      where: { id: exam.id },
      data: { isPublished: true, publishedAt: new Date() },
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'exam.published',
      entityType: 'exam',
      entityId: exam.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ published: true });
  } catch (err) {
    next(err);
  }
});

examsRouter.get('/report-card/:studentId', requirePermission('exams.view'), async (req, res, next) => {
  try {
    const studentId = req.params.studentId;
    if (!studentId) throw Errors.badRequest('Student ID is required');
    const student = await req.tenantPrisma!.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw Errors.notFound('Student not found');

    const marks = await req.tenantPrisma!.mark.findMany({
      where: { studentId: student.id, examSubject: { exam: { isPublished: true } } },
      include: { examSubject: { include: { exam: true } } },
    });

    res.json({
      student: { id: student.id, admissionNumber: student.admissionNumber, name: `${student.firstName} ${student.lastName}` },
      results: marks.map((m) => ({
        examName: m.examSubject.exam.name,
        subjectId: m.examSubject.subjectId,
        status: m.status,
        marksObtained: m.marksObtained,
        maxMarks: m.examSubject.maxMarks,
        passingMarks: m.examSubject.passingMarks,
      })),
    });
  } catch (err) {
    next(err);
  }
});

examsRouter.get('/report-card/:studentId.pdf', requirePermission('exams.view'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const studentId = req.params.studentId;
    if (!studentId) throw Errors.badRequest('Student ID is required');
    const student = await req.tenantPrisma!.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw Errors.notFound('Student not found');

    const [school, marks, subjects] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      req.tenantPrisma!.mark.findMany({
        where: { studentId: student.id, examSubject: { exam: { isPublished: true } } },
        include: { examSubject: { include: { exam: true } } },
      }),
      req.tenantPrisma!.subject.findMany({ select: { id: true, name: true } }),
    ]);

    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
    const pdf = await buildReportCardPdf({
      schoolName: school?.name ?? 'School ERP',
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      results: marks.map((m) => ({
        examName: m.examSubject.exam.name,
        subjectName: subjectNameById.get(m.examSubject.subjectId) ?? m.examSubject.subjectId,
        status: m.status,
        marksObtained: m.marksObtained ? String(m.marksObtained) : null,
        maxMarks: String(m.examSubject.maxMarks),
        passingMarks: String(m.examSubject.passingMarks),
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-card-${student.admissionNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});
