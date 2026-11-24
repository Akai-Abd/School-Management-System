import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const createFeeTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(30).toUpperCase(),
  description: z.string().trim().max(240).optional(),
});

export const createFeeStructureSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  items: z
    .array(
      z.object({
        feeTypeId: z.string().uuid(),
        amount: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  dueDate: isoDateSchema,
  discountAmount: z.coerce.number().nonnegative().default(0),
  items: z
    .array(
      z.object({
        feeTypeId: z.string().uuid(),
        description: z.string().trim().min(2).max(160),
        amount: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export const collectPaymentSchema = z.object({
  studentId: z.string().uuid(),
  paymentDate: isoDateSchema,
  amount: z.coerce.number().positive(),
  mode: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'card']),
  referenceNo: z.string().trim().max(80).optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.coerce.number().positive(),
      }),
    )
    .default([]),
});

export const requestRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(3).max(300),
});

export const decideRefundSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});
