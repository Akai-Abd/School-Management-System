import { Router } from 'express';
import { createBookSchema, issueBookSchema } from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function calculateOverdueFine(dueDate: Date, returnedAt: Date, dailyRate = 10): number {
  const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const returnDay = Date.UTC(returnedAt.getUTCFullYear(), returnedAt.getUTCMonth(), returnedAt.getUTCDate());
  const overdueDays = Math.max(0, Math.floor((returnDay - dueDay) / (24 * 60 * 60 * 1000)));
  return Math.round(overdueDays * dailyRate * 100) / 100;
}

export const libraryRouter = Router();
libraryRouter.use(requireAuth, requireSchoolContext, requireModule('library'));

libraryRouter.get('/books', requirePermission('library.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.book.findMany({
      include: { copies: { include: { issues: { where: { returnedAt: null } } } } },
      orderBy: { title: 'asc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

libraryRouter.post('/books', requireCsrf, requirePermission('library.create'), validateBody(createBookSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const created = await prisma.book.create({
      data: {
        schoolId,
        title: req.body.title,
        author: req.body.author,
        publisher: req.body.publisher,
        isbn: req.body.isbn,
        copies: {
          create: req.body.accessionNumbers.map((accessionNumber: string) => ({ accessionNumber })),
        },
      },
      include: { copies: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

libraryRouter.get('/issues', requirePermission('library.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.bookIssue.findMany({
      include: { copy: { include: { book: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

libraryRouter.post('/issues', requireCsrf, requirePermission('library.create'), validateBody(issueBookSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const issue = await prisma.$transaction(async (tx) => {
      const copy = await tx.bookCopy.findFirst({ where: { id: req.body.copyId, schoolId } });
      if (!copy) throw Errors.notFound('Book copy not found');
      if (copy.status !== 'available') throw Errors.conflict('Book copy is not available for issue');

      await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'issued' } });
      return tx.bookIssue.create({
        data: {
          schoolId,
          copyId: copy.id,
          borrowerType: req.body.borrowerType,
          studentId: req.body.studentId,
          staffId: req.body.staffId,
          dueDate: new Date(req.body.dueDate),
        },
      });
    });

    res.status(201).json(issue);
  } catch (err) {
    next(err);
  }
});

libraryRouter.post('/issues/:id/return', requireCsrf, requirePermission('library.update'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const issueId = req.params.id;
    if (!issueId) throw Errors.badRequest('Issue ID is required');

    const issue = await req.tenantPrisma!.bookIssue.findFirst({ where: { id: issueId } });
    if (!issue) throw Errors.notFound('Book issue not found');
    if (issue.returnedAt) throw Errors.badRequest('Book has already been returned');

    const returnedAt = new Date();
    const fineAmount = calculateOverdueFine(issue.dueDate, returnedAt);

    await prisma.$transaction([
      prisma.bookIssue.update({
        where: { id: issue.id },
        data: { returnedAt, fineAmount, finePaid: fineAmount === 0 },
      }),
      prisma.bookCopy.update({
        where: { id: issue.copyId },
        data: { status: 'available' },
      }),
    ]);

    if (fineAmount > 0) {
      await recordAuditLog({
        schoolId,
        actorUserId: req.auth!.userId,
        action: 'library.fine_assessed',
        entityType: 'book_issue',
        entityId: issue.id,
        metadata: { fineAmount },
        ipAddress: req.ip,
        requestId: req.requestId,
      });
    }

    res.json({ returnedAt, fineAmount });
  } catch (err) {
    next(err);
  }
});
