import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const createAccountSchema = z.object({
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2).max(120),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
});

export const createFiscalYearSchema = z.object({
  name: z.string().trim().min(2).max(60),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const createAccountingPeriodSchema = z.object({
  fiscalYearId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const upsertPostingRuleSchema = z.object({
  eventType: z.enum(['invoice.created', 'payment.collected', 'payment.bounced', 'refund.approved']),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

export const createJournalEntrySchema = z.object({
  entryDate: isoDateSchema,
  description: z.string().trim().min(2).max(240),
  lines: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        debit: z.coerce.number().nonnegative().default(0),
        credit: z.coerce.number().nonnegative().default(0),
        memo: z.string().trim().max(160).optional(),
      }),
    )
    .min(2),
});

export const syncFinancialEventsSchema = z.object({
  fromDate: isoDateSchema,
});
