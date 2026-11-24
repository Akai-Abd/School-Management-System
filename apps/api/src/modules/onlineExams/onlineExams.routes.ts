import { Router } from 'express';
import {
  createOnlineExamSchema,
  createQuestionBankSchema,
  createQuestionSchema,
  evaluateAnswerSchema,
  saveExamAnswerSchema,
} from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function isAttemptExpired(expiresAt: Date, now = new Date()): boolean {
  return now.getTime() > expiresAt.getTime();
}

export function autoGradeObjectiveAnswer(
  questionType: 'mcq' | 'msq' | 'true_false' | 'descriptive',
  options: Array<{ id: string; isCorrect: boolean }>,
  selectedOptionIds: string[],
  maxMarks: number,
): number | null {
  if (questionType === 'descriptive') return null;
  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id).sort();
  const selected = [...new Set(selectedOptionIds)].sort();
  if (correctIds.length === 0) return 0;
  const exactMatch =
    correctIds.length === selected.length && correctIds.every((id, idx) => id === selected[idx]);
  return exactMatch ? maxMarks : 0;
}

export const onlineExamsRouter = Router();
onlineExamsRouter.use(requireAuth, requireSchoolContext, requireModule('online_exams'));

onlineExamsRouter.get('/banks', requirePermission('exams.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.questionBank.findMany({
      include: { questions: { include: { options: true } } },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.post('/banks', requireCsrf, requirePermission('exams.create'), validateBody(createQuestionBankSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.questionBank.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.post('/banks/:bankId/questions', requireCsrf, requirePermission('exams.create'), validateBody(createQuestionSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const bankId = req.params.bankId;
    if (!bankId) throw Errors.badRequest('Bank ID is required');
    const bank = await req.tenantPrisma!.questionBank.findFirst({ where: { id: bankId } });
    if (!bank) throw Errors.notFound('Question bank not found');

    const created = await prisma.question.create({
      data: {
        schoolId,
        bankId: bank.id,
        questionType: req.body.questionType,
        prompt: req.body.prompt,
        marks: req.body.marks,
        correctAnswer: req.body.correctAnswer,
        options: { create: req.body.options },
      },
      include: { options: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.get('/', requirePermission('exams.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.onlineExam.findMany({
      include: { questions: true, attempts: true },
      orderBy: { startsAt: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.post('/', requireCsrf, requirePermission('exams.create'), validateBody(createOnlineExamSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const startsAt = new Date(req.body.startsAt);
    const endsAt = new Date(req.body.endsAt);
    if (startsAt >= endsAt) throw Errors.badRequest('startsAt must be before endsAt');

    const created = await prisma.onlineExam.create({
      data: {
        schoolId,
        academicYearId: req.body.academicYearId,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        title: req.body.title,
        durationMinutes: req.body.durationMinutes,
        startsAt,
        endsAt,
        randomizeQuestions: req.body.randomizeQuestions,
        questions: {
          create: req.body.questionIds.map((questionId: string, idx: number) => ({
            questionId,
            sortOrder: idx,
          })),
        },
      },
      include: { questions: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/** Starts or resumes a timed exam attempt; strips correct answers before release (M08-AC1/AC2). */
onlineExamsRouter.post('/:id/start', requireCsrf, async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const examId = req.params.id;
    if (!examId) throw Errors.badRequest('Exam ID is required');

    const student = await req.tenantPrisma!.student.findFirst({ where: { userId: req.auth!.userId, deletedAt: null } });
    if (!student) throw Errors.forbidden('Linked student profile required to start online exam');

    const exam = await req.tenantPrisma!.onlineExam.findFirst({
      where: { id: examId },
      include: { questions: { include: { question: { include: { options: true } } }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!exam) throw Errors.notFound('Online exam not found');

    const now = new Date();
    if (now < exam.startsAt || now > exam.endsAt) {
      throw Errors.forbidden('Online exam is not currently open');
    }

    let attempt = await prisma.examAttempt.findUnique({
      where: { schoolId_onlineExamId_studentId: { schoolId, onlineExamId: exam.id, studentId: student.id } },
      include: { answers: true },
    });

    if (!attempt) {
      const expiresAt = new Date(Math.min(exam.endsAt.getTime(), now.getTime() + exam.durationMinutes * 60_000));
      attempt = await prisma.examAttempt.create({
        data: { schoolId, onlineExamId: exam.id, studentId: student.id, expiresAt },
        include: { answers: true },
      });
    }

    const questions = exam.questions.map((eq) => ({
      id: eq.question.id,
      questionType: eq.question.questionType,
      prompt: eq.question.prompt,
      marks: eq.question.marks,
      options: eq.question.options.map((o) => ({
        id: o.id,
        label: o.label,
        ...(exam.answersReleased ? { isCorrect: o.isCorrect } : {}),
      })),
    }));

    res.json({ attempt, questions });
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.put('/attempts/:attemptId/answers', requireCsrf, validateBody(saveExamAnswerSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const attemptId = req.params.attemptId;
    if (!attemptId) throw Errors.badRequest('Attempt ID is required');
    const attempt = await req.tenantPrisma!.examAttempt.findFirst({ where: { id: attemptId } });
    if (!attempt) throw Errors.notFound('Exam attempt not found');
    if (attempt.status !== 'in_progress') throw Errors.forbidden('Submitted attempts cannot be modified');
    if (isAttemptExpired(attempt.expiresAt)) throw Errors.forbidden('Exam attempt time has expired');

    const saved = await prisma.examAnswer.upsert({
      where: { schoolId_attemptId_questionId: { schoolId, attemptId: attempt.id, questionId: req.body.questionId } },
      update: { answerText: req.body.answerText, selectedOptionIds: req.body.selectedOptionIds },
      create: {
        schoolId,
        attemptId: attempt.id,
        questionId: req.body.questionId,
        answerText: req.body.answerText,
        selectedOptionIds: req.body.selectedOptionIds,
      },
    });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.post('/attempts/:attemptId/submit', requireCsrf, async (req, res, next) => {
  try {
    const attemptId = req.params.attemptId;
    if (!attemptId) throw Errors.badRequest('Attempt ID is required');
    const attempt = await req.tenantPrisma!.examAttempt.findFirst({
      where: { id: attemptId },
      include: {
        answers: true,
        onlineExam: { include: { questions: { include: { question: { include: { options: true } } } } } },
      },
    });
    if (!attempt) throw Errors.notFound('Attempt not found');
    if (attempt.status !== 'in_progress') throw Errors.badRequest('Attempt already submitted');

    let totalScore = 0;
    let hasDescriptive = false;

    await prisma.$transaction(async (tx) => {
      for (const link of attempt.onlineExam.questions) {
        const q = link.question;
        const ans = attempt.answers.find((a) => a.questionId === q.id);
        const selected = Array.isArray(ans?.selectedOptionIds) ? (ans.selectedOptionIds as string[]) : [];
        const score = autoGradeObjectiveAnswer(q.questionType, q.options, selected, Number(q.marks));
        if (score === null) {
          hasDescriptive = true;
        } else {
          totalScore += score;
          if (ans) {
            await tx.examAnswer.update({ where: { id: ans.id }, data: { marksAwarded: score } });
          }
        }
      }

      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          submittedAt: new Date(),
          totalScore,
          status: hasDescriptive ? 'submitted' : 'evaluated',
        },
      });
    });

    res.json({ submitted: true, totalScore });
  } catch (err) {
    next(err);
  }
});

onlineExamsRouter.patch('/answers/:answerId/evaluate', requireCsrf, requirePermission('exams.update'), validateBody(evaluateAnswerSchema), async (req, res, next) => {
  try {
    const answerId = req.params.answerId;
    if (!answerId) throw Errors.badRequest('Answer ID is required');
    const ans = await req.tenantPrisma!.examAnswer.findFirst({ where: { id: answerId } });
    if (!ans) throw Errors.notFound('Answer not found');

    await prisma.$transaction(async (tx) => {
      await tx.examAnswer.update({ where: { id: ans.id }, data: { marksAwarded: req.body.marksAwarded } });
      const all = await tx.examAnswer.findMany({ where: { attemptId: ans.attemptId } });
      const totalScore = all.reduce((s, a) => s + Number(a.marksAwarded ?? 0), 0);
      await tx.examAttempt.update({ where: { id: ans.attemptId }, data: { totalScore, status: 'evaluated' } });
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});
