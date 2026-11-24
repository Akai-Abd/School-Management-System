import { Router } from 'express';
import { createHomeworkSchema, evaluateHomeworkSchema, submitHomeworkSchema } from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export const homeworkRouter = Router();
homeworkRouter.use(requireAuth, requireSchoolContext, requireModule('homework'));

homeworkRouter.get('/', requirePermission('homework.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.homework.findMany({
      include: { submissions: true },
      orderBy: { dueDate: 'desc' },
      take: 50,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

homeworkRouter.post('/', requireCsrf, requirePermission('homework.create'), validateBody(createHomeworkSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.homework.create({
      data: {
        schoolId: req.auth!.activeSchoolId!,
        academicYearId: req.body.academicYearId,
        sectionId: req.body.sectionId,
        subjectId: req.body.subjectId,
        title: req.body.title,
        description: req.body.description,
        dueDate: new Date(req.body.dueDate),
        maxMarks: req.body.maxMarks,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

homeworkRouter.post('/:id/submit', requireCsrf, requirePermission('homework.create'), validateBody(submitHomeworkSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const homeworkId = req.params.id;
    if (!homeworkId) throw Errors.badRequest('Homework ID is required');

    const hw = await req.tenantPrisma!.homework.findFirst({ where: { id: homeworkId } });
    if (!hw) throw Errors.notFound('Homework not found');

    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        schoolId_homeworkId_studentId: { schoolId, homeworkId: hw.id, studentId: req.body.studentId },
      },
      update: { content: req.body.content, submittedAt: new Date() },
      create: {
        schoolId,
        homeworkId: hw.id,
        studentId: req.body.studentId,
        content: req.body.content,
      },
    });
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
});

homeworkRouter.patch('/submissions/:submissionId/evaluate', requireCsrf, requirePermission('homework.update'), validateBody(evaluateHomeworkSchema), async (req, res, next) => {
  try {
    const submissionId = req.params.submissionId;
    if (!submissionId) throw Errors.badRequest('Submission ID is required');
    const sub = await req.tenantPrisma!.homeworkSubmission.findFirst({ where: { id: submissionId } });
    if (!sub) throw Errors.notFound('Submission not found');

    const updated = await prisma.homeworkSubmission.update({
      where: { id: sub.id },
      data: {
        marksAwarded: req.body.marksAwarded,
        feedback: req.body.feedback,
        evaluatedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
