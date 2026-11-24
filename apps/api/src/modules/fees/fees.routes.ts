import crypto from 'node:crypto';
import { Router } from 'express';
import {
  collectPaymentSchema,
  createFeeStructureSchema,
  createFeeTypeSchema,
  createInvoiceSchema,
  decideRefundSchema,
  requestRefundSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { buildReceiptPdf } from '../../lib/pdf.js';
import { nextDocumentNumber, prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function computeInvoiceStatus(totalAmount: number, discountAmount: number, paidAmount: number): 'paid' | 'partial' | 'unpaid' {
  const netDue = Math.max(0, totalAmount - discountAmount);
  if (paidAmount >= netDue && netDue > 0) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function validatePaymentAllocation(
  paymentAmount: number,
  allocations: Array<{ invoiceId: string; amount: number }>,
  invoiceRemainingById: Map<string, number>,
): number {
  let allocatedTotal = 0;
  for (const alloc of allocations) {
    const remaining = invoiceRemainingById.get(alloc.invoiceId);
    if (remaining === undefined) throw Errors.badRequest(`Invoice ${alloc.invoiceId} not found`);
    if (alloc.amount > remaining) {
      throw Errors.badRequest(`Allocation ${alloc.amount} exceeds invoice remaining balance ${remaining}`);
    }
    allocatedTotal += alloc.amount;
  }
  if (allocatedTotal > paymentAmount) {
    throw Errors.badRequest(`Total allocations (${allocatedTotal}) cannot exceed payment amount (${paymentAmount})`);
  }
  return Math.round((paymentAmount - allocatedTotal) * 100) / 100;
}

export function assertDifferentApprover(requestedByUserId: string, approverUserId: string): void {
  if (requestedByUserId === approverUserId) {
    throw Errors.forbidden('Maker-checker policy: requester cannot approve their own request');
  }
}

export const feesRouter = Router();
feesRouter.use(requireAuth, requireSchoolContext, requireModule('fees'));

feesRouter.get('/fee-types', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.feeType.findMany({ orderBy: { name: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

feesRouter.post('/fee-types', requireCsrf, requirePermission('fees.create'), validateBody(createFeeTypeSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.feeType.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/fee-structures', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.feeStructure.findMany({
      include: { items: { include: { feeType: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

feesRouter.post('/fee-structures', requireCsrf, requirePermission('fees.create'), validateBody(createFeeStructureSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const created = await prisma.feeStructure.create({
      data: {
        schoolId,
        academicYearId: req.body.academicYearId,
        classId: req.body.classId,
        name: req.body.name,
        items: {
          create: req.body.items.map((it: { feeTypeId: string; amount: number }) => ({
            schoolId,
            feeTypeId: it.feeTypeId,
            amount: it.amount,
          })),
        },
      },
      include: { items: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/invoices', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.invoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

feesRouter.post('/invoices', requireCsrf, requirePermission('fees.create'), validateBody(createInvoiceSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const totalAmount = req.body.items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
    if (req.body.discountAmount > totalAmount) {
      throw Errors.badRequest('Discount cannot exceed invoice total');
    }

    const created = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(tx, schoolId, 'invoice');
      const invoice = await tx.invoice.create({
        data: {
          schoolId,
          studentId: req.body.studentId,
          academicYearId: req.body.academicYearId,
          invoiceNumber,
          dueDate: new Date(req.body.dueDate),
          totalAmount,
          discountAmount: req.body.discountAmount,
          status: computeInvoiceStatus(totalAmount, req.body.discountAmount, 0),
          items: {
            create: req.body.items.map((it: { feeTypeId: string; description: string; amount: number }) => ({
              schoolId,
              feeTypeId: it.feeTypeId,
              description: it.description,
              amount: it.amount,
            })),
          },
        },
        include: { items: true },
      });

      await tx.financialEvent.create({
        data: {
          schoolId,
          eventType: 'invoice.created',
          entityType: 'invoice',
          entityId: invoice.id,
          amount: totalAmount - req.body.discountAmount,
          payload: { invoiceNumber },
          actorUserId: req.auth!.userId,
        },
      });
      return invoice;
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/payments', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.payment.findMany({
      include: { allocations: true, credits: true, refunds: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

feesRouter.post('/payments', requireCsrf, requirePermission('fees.create'), validateBody(collectPaymentSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const idempotencyKey = req.header('idempotency-key');
    const routeKey = 'POST:/api/v1/fees/payments';
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { schoolId_key_route: { schoolId, key: idempotencyKey, route: routeKey } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw Errors.conflict('Idempotency key reused with a different payload');
        }
        return res.status(existing.statusCode).json(existing.responseJson);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoiceIds = req.body.allocations.map((a: { invoiceId: string }) => a.invoiceId);
      const invoices = invoiceIds.length
        ? await tx.invoice.findMany({ where: { id: { in: invoiceIds }, schoolId, studentId: req.body.studentId } })
        : [];
      const remainingById = new Map<string, number>();
      for (const inv of invoices) {
        const net = Number(inv.totalAmount) - Number(inv.discountAmount);
        remainingById.set(inv.id, Math.max(0, net - Number(inv.paidAmount)));
      }

      const creditRemainder = validatePaymentAllocation(req.body.amount, req.body.allocations, remainingById);
      const receiptNumber = await nextDocumentNumber(tx, schoolId, 'receipt');

      const payment = await tx.payment.create({
        data: {
          schoolId,
          studentId: req.body.studentId,
          receiptNumber,
          paymentDate: new Date(req.body.paymentDate),
          amount: req.body.amount,
          mode: req.body.mode,
          referenceNo: req.body.referenceNo,
          instrumentStatus: req.body.mode === 'cheque' ? 'received' : 'cleared',
          createdByUserId: req.auth!.userId,
        },
      });

      for (const alloc of req.body.allocations as Array<{ invoiceId: string; amount: number }>) {
        await tx.paymentAllocation.create({
          data: { schoolId, paymentId: payment.id, invoiceId: alloc.invoiceId, amount: alloc.amount },
        });
        const inv = invoices.find((i) => i.id === alloc.invoiceId)!;
        const newPaid = Number(inv.paidAmount) + alloc.amount;
        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: newPaid,
            status: computeInvoiceStatus(Number(inv.totalAmount), Number(inv.discountAmount), newPaid),
            version: { increment: 1 },
          },
        });
      }

      if (creditRemainder > 0) {
        await tx.studentCredit.create({
          data: {
            schoolId,
            studentId: req.body.studentId,
            paymentId: payment.id,
            amount: creditRemainder,
            remainingAmount: creditRemainder,
          },
        });
      }

      await tx.financialEvent.create({
        data: {
          schoolId,
          eventType: 'payment.collected',
          entityType: 'payment',
          entityId: payment.id,
          amount: req.body.amount,
          payload: { receiptNumber, mode: req.body.mode, creditRemainder },
          actorUserId: req.auth!.userId,
        },
      });

      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            schoolId,
            key: idempotencyKey,
            route: routeKey,
            requestHash,
            statusCode: 201,
            responseJson: payment as unknown as object,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      return payment;
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/payments/:id/receipt', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const payment = await req.tenantPrisma!.payment.findFirst({
      where: { id: req.params.id },
      include: { allocations: { include: { invoice: true } } },
    });
    if (!payment) throw Errors.notFound('Payment not found');
    res.json({ receipt: payment });
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/payments/:id/receipt.pdf', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const payment = await req.tenantPrisma!.payment.findFirst({
      where: { id: req.params.id },
      include: { allocations: { include: { invoice: true } } },
    });
    if (!payment) throw Errors.notFound('Payment not found');

    const [school, student] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      req.tenantPrisma!.student.findFirst({ where: { id: payment.studentId } }),
    ]);

    const pdf = await buildReceiptPdf({
      schoolName: school?.name ?? 'School ERP',
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      studentName: student ? `${student.firstName} ${student.lastName}` : payment.studentId,
      admissionNumber: student?.admissionNumber ?? '—',
      amount: String(payment.amount),
      mode: payment.mode,
      allocations: payment.allocations.map((a) => ({
        invoiceNumber: a.invoice.invoiceNumber,
        amount: String(a.amount),
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payment.receiptNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

feesRouter.post('/payments/:id/bounce', requireCsrf, requirePermission('fees.update'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const paymentId = req.params.id;
    if (!paymentId) throw Errors.badRequest('Payment ID is required');

    const payment = await req.tenantPrisma!.payment.findFirst({
      where: { id: paymentId },
      include: { allocations: { where: { isReversed: false } } },
    });
    if (!payment) throw Errors.notFound('Payment not found');
    if (payment.mode !== 'cheque' || payment.instrumentStatus === 'bounced') {
      throw Errors.badRequest('Only active cheque payments can be marked bounced');
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { instrumentStatus: 'bounced' } });

      for (const alloc of payment.allocations) {
        await tx.paymentAllocation.update({ where: { id: alloc.id }, data: { isReversed: true } });
        const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
        if (inv) {
          const nextPaid = Math.max(0, Number(inv.paidAmount) - Number(alloc.amount));
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: nextPaid,
              status: computeInvoiceStatus(Number(inv.totalAmount), Number(inv.discountAmount), nextPaid),
              version: { increment: 1 },
            },
          });
        }
      }

      await tx.financialEvent.create({
        data: {
          schoolId,
          eventType: 'payment.bounced',
          entityType: 'payment',
          entityId: payment.id,
          amount: Number(payment.amount),
          payload: { receiptNumber: payment.receiptNumber },
          actorUserId: req.auth!.userId,
        },
      });
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'payment.cheque_bounced',
      entityType: 'payment',
      entityId: payment.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ bounced: true });
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/refunds', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.paymentRefund.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

feesRouter.post('/refunds', requireCsrf, requirePermission('fees.create'), validateBody(requestRefundSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const payment = await req.tenantPrisma!.payment.findFirst({
      where: { id: req.body.paymentId },
      include: { refunds: { where: { status: { in: ['pending', 'approved'] } } } },
    });
    if (!payment) throw Errors.notFound('Payment not found');
    if (payment.instrumentStatus === 'bounced') throw Errors.badRequest('Cannot refund a bounced cheque');

    const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    if (req.body.amount > Number(payment.amount) - alreadyRefunded) {
      throw Errors.badRequest('Refund exceeds refundable payment balance');
    }

    const created = await req.tenantPrisma!.paymentRefund.create({
      data: {
        schoolId,
        paymentId: payment.id,
        amount: req.body.amount,
        reason: req.body.reason,
        requestedByUserId: req.auth!.userId,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

feesRouter.patch('/refunds/:id/decide', requireCsrf, requirePermission('fees.approve'), validateBody(decideRefundSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const refundId = req.params.id;
    if (!refundId) throw Errors.badRequest('Refund ID is required');
    const refund = await req.tenantPrisma!.paymentRefund.findFirst({ where: { id: refundId } });
    if (!refund) throw Errors.notFound('Refund request not found');
    if (refund.status !== 'pending') throw Errors.badRequest('Refund has already been decided');

    assertDifferentApprover(refund.requestedByUserId, req.auth!.userId);

    await prisma.$transaction(async (tx) => {
      await tx.paymentRefund.update({
        where: { id: refund.id },
        data: { status: req.body.decision, approvedByUserId: req.auth!.userId },
      });
      if (req.body.decision === 'approved') {
        await tx.financialEvent.create({
          data: {
            schoolId,
            eventType: 'refund.approved',
            entityType: 'payment_refund',
            entityId: refund.id,
            amount: Number(refund.amount),
            payload: { paymentId: refund.paymentId },
            actorUserId: req.auth!.userId,
          },
        });
      }
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: `refund.${req.body.decision}`,
      entityType: 'payment_refund',
      entityId: refund.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ status: req.body.decision });
  } catch (err) {
    next(err);
  }
});

feesRouter.get('/summary', requirePermission('fees.view'), async (req, res, next) => {
  try {
    const [invoices, payments, refunds] = await Promise.all([
      req.tenantPrisma!.invoice.findMany({ where: { status: { not: 'cancelled' } } }),
      req.tenantPrisma!.payment.findMany({ where: { instrumentStatus: { not: 'bounced' } } }),
      req.tenantPrisma!.paymentRefund.findMany({ where: { status: 'approved' } }),
    ]);

    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.discountAmount), 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount), 0);
    const totalOutstanding = invoices.reduce(
      (s, i) => s + Math.max(0, Number(i.totalAmount) - Number(i.discountAmount) - Number(i.paidAmount)),
      0,
    );

    res.json({ totalInvoiced, totalCollected, totalRefunded, totalOutstanding });
  } catch (err) {
    next(err);
  }
});
