import { Router } from 'express';
import {
  createAccountingPeriodSchema,
  createAccountSchema,
  createFiscalYearSchema,
  createJournalEntrySchema,
  syncFinancialEventsSchema,
  upsertPostingRuleSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { nextDocumentNumber, prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
}

export function assertBalancedJournalLines(lines: JournalLineInput[]): void {
  if (lines.length < 2) throw Errors.badRequest('Journal entry requires at least two lines');
  let debitCents = 0;
  let creditCents = 0;

  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) throw Errors.badRequest('Debits and credits must be non-negative');
    if (line.debit > 0 && line.credit > 0) throw Errors.badRequest('A line cannot have both debit and credit');
    if (line.debit === 0 && line.credit === 0) throw Errors.badRequest('A line must have a non-zero debit or credit');
    debitCents += Math.round(line.debit * 100);
    creditCents += Math.round(line.credit * 100);
  }

  if (debitCents !== creditCents || debitCents === 0) {
    throw Errors.badRequest(`Journal entry does not balance (debits ${debitCents / 100} != credits ${creditCents / 100})`);
  }
}

export function computeFinancialStatements(
  accounts: Array<{ id: string; code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' }>,
  lines: Array<{ accountId: string; debit: number; credit: number }>,
) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const curr = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
    curr.debit += line.debit;
    curr.credit += line.credit;
    totals.set(line.accountId, curr);
  }

  const trialBalance = accounts.map((acc) => {
    const t = totals.get(acc.id) ?? { debit: 0, credit: 0 };
    const debit = Math.round(t.debit * 100) / 100;
    const credit = Math.round(t.credit * 100) / 100;
    return { ...acc, debit, credit, netDebitCredit: Math.round((debit - credit) * 100) / 100 };
  });

  const totalIncome = trialBalance
    .filter((a) => a.type === 'income')
    .reduce((s, a) => s + (a.credit - a.debit), 0);
  const totalExpense = trialBalance
    .filter((a) => a.type === 'expense')
    .reduce((s, a) => s + (a.debit - a.credit), 0);
  const netIncome = Math.round((totalIncome - totalExpense) * 100) / 100;

  const totalAssets = trialBalance
    .filter((a) => a.type === 'asset')
    .reduce((s, a) => s + (a.debit - a.credit), 0);
  const totalLiabilities = trialBalance
    .filter((a) => a.type === 'liability')
    .reduce((s, a) => s + (a.credit - a.debit), 0);
  const totalEquity = trialBalance
    .filter((a) => a.type === 'equity')
    .reduce((s, a) => s + (a.credit - a.debit), 0);

  return {
    trialBalance,
    incomeStatement: {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netIncome,
    },
    balanceSheet: {
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      totalEquityWithNetIncome: Math.round((totalEquity + netIncome) * 100) / 100,
    },
  };
}

async function assertPeriodOpen(schoolId: string, entryDate: Date): Promise<void> {
  const closedPeriod = await prisma.accountingPeriod.findFirst({
    where: {
      schoolId,
      isClosed: true,
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
  });
  if (closedPeriod) {
    throw Errors.forbidden(`Accounting period '${closedPeriod.name}' is closed for ${entryDate.toISOString().slice(0, 10)}`);
  }
}

export const accountingRouter = Router();
accountingRouter.use(requireAuth, requireSchoolContext, requireModule('accounting'));

accountingRouter.get('/accounts', requirePermission('accounting.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.account.findMany({ orderBy: { code: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post('/accounts', requireCsrf, requirePermission('accounting.create'), validateBody(createAccountSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.account.create({
      data: { schoolId: req.auth!.activeSchoolId!, ...req.body },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

accountingRouter.post('/accounts/seed-defaults', requireCsrf, requirePermission('accounting.create'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const defaults = [
      { code: '1000', name: 'Cash and Bank', type: 'asset' as const, isSystem: true },
      { code: '1100', name: 'Student Fee Receivable', type: 'asset' as const, isSystem: true },
      { code: '3000', name: 'Opening Equity', type: 'equity' as const, isSystem: true },
      { code: '4000', name: 'Tuition and Fee Income', type: 'income' as const, isSystem: true },
      { code: '5000', name: 'Fee Refunds and Reversals', type: 'expense' as const, isSystem: true },
    ];

    await prisma.$transaction(async (tx) => {
      const byCode = new Map<string, string>();
      for (const acc of defaults) {
        const row = await tx.account.upsert({
          where: { schoolId_code: { schoolId, code: acc.code } },
          update: {},
          create: { schoolId, ...acc },
        });
        byCode.set(acc.code, row.id);
      }

      const rules = [
        { eventType: 'invoice.created', debitAccountId: byCode.get('1100')!, creditAccountId: byCode.get('4000')! },
        { eventType: 'payment.collected', debitAccountId: byCode.get('1000')!, creditAccountId: byCode.get('1100')! },
        { eventType: 'payment.bounced', debitAccountId: byCode.get('1100')!, creditAccountId: byCode.get('1000')! },
        { eventType: 'refund.approved', debitAccountId: byCode.get('5000')!, creditAccountId: byCode.get('1000')! },
      ];
      for (const rule of rules) {
        await tx.postingRule.upsert({
          where: { schoolId_eventType: { schoolId, eventType: rule.eventType } },
          update: {},
          create: { schoolId, ...rule },
        });
      }
    });

    res.status(201).json({ seeded: true });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get('/fiscal-years', requirePermission('accounting.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.fiscalYear.findMany({
      include: { periods: { orderBy: { startDate: 'asc' } } },
      orderBy: { startDate: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post('/fiscal-years', requireCsrf, requirePermission('accounting.create'), validateBody(createFiscalYearSchema), async (req, res, next) => {
  try {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (startDate >= endDate) throw Errors.badRequest('Fiscal year startDate must be before endDate');

    const created = await req.tenantPrisma!.fiscalYear.create({
      data: { schoolId: req.auth!.activeSchoolId!, name: req.body.name, startDate, endDate },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

accountingRouter.post('/periods', requireCsrf, requirePermission('accounting.create'), validateBody(createAccountingPeriodSchema), async (req, res, next) => {
  try {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (startDate > endDate) throw Errors.badRequest('Period startDate cannot be after endDate');

    const created = await req.tenantPrisma!.accountingPeriod.create({
      data: {
        schoolId: req.auth!.activeSchoolId!,
        fiscalYearId: req.body.fiscalYearId,
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

accountingRouter.patch('/periods/:id/toggle-close', requireCsrf, requirePermission('accounting.approve'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const periodId = req.params.id;
    if (!periodId) throw Errors.badRequest('Period ID is required');
    const period = await req.tenantPrisma!.accountingPeriod.findFirst({ where: { id: periodId } });
    if (!period) throw Errors.notFound('Accounting period not found');

    const nextClosed = !period.isClosed;
    await prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        isClosed: nextClosed,
        reopenedByUserId: nextClosed ? null : req.auth!.userId,
      },
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: nextClosed ? 'accounting.period_closed' : 'accounting.period_reopened',
      entityType: 'accounting_period',
      entityId: period.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ isClosed: nextClosed });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get('/posting-rules', requirePermission('accounting.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.postingRule.findMany({ orderBy: { eventType: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

accountingRouter.put('/posting-rules', requireCsrf, requirePermission('accounting.update'), validateBody(upsertPostingRuleSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const updated = await prisma.postingRule.upsert({
      where: { schoolId_eventType: { schoolId, eventType: req.body.eventType } },
      update: {
        debitAccountId: req.body.debitAccountId,
        creditAccountId: req.body.creditAccountId,
        isActive: req.body.isActive,
      },
      create: { schoolId, ...req.body },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

accountingRouter.get('/journals', requirePermission('accounting.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.journalEntry.findMany({
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post('/journals', requireCsrf, requirePermission('accounting.create'), validateBody(createJournalEntrySchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const entryDate = new Date(req.body.entryDate);
    assertBalancedJournalLines(req.body.lines);
    await assertPeriodOpen(schoolId, entryDate);

    const created = await prisma.$transaction(async (tx) => {
      const journalNumber = await nextDocumentNumber(tx, schoolId, 'journal');
      return tx.journalEntry.create({
        data: {
          schoolId,
          journalNumber,
          entryDate,
          description: req.body.description,
          createdByUserId: req.auth!.userId,
          lines: {
            create: req.body.lines.map((l: JournalLineInput) => ({
              schoolId,
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              memo: l.memo,
            })),
          },
        },
        include: { lines: true },
      });
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

accountingRouter.post('/journals/:id/reverse', requireCsrf, requirePermission('accounting.update'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const entryId = req.params.id;
    if (!entryId) throw Errors.badRequest('Journal entry ID is required');

    const original = await req.tenantPrisma!.journalEntry.findFirst({
      where: { id: entryId },
      include: { lines: true },
    });
    if (!original) throw Errors.notFound('Journal entry not found');
    if (original.status === 'reversed') throw Errors.badRequest('Journal entry is already reversed');

    const today = new Date();
    await assertPeriodOpen(schoolId, today);

    const reversal = await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({ where: { id: original.id }, data: { status: 'reversed' } });
      const journalNumber = await nextDocumentNumber(tx, schoolId, 'journal');
      return tx.journalEntry.create({
        data: {
          schoolId,
          journalNumber,
          entryDate: today,
          description: `Reversal of ${original.journalNumber}: ${original.description}`,
          reversedEntryId: original.id,
          createdByUserId: req.auth!.userId,
          lines: {
            create: original.lines.map((l) => ({
              schoolId,
              accountId: l.accountId,
              debit: l.credit,
              credit: l.debit,
              memo: `Reversal of ${original.journalNumber}`,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'accounting.journal_reversed',
      entityType: 'journal_entry',
      entityId: original.id,
      metadata: { reversalId: reversal.id, reversalNumber: reversal.journalNumber },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(reversal);
  } catch (err) {
    next(err);
  }
});

/** Posts unposted financial_events from fromDate forward using school posting_rules (M11-AC6/AC7). */
accountingRouter.post('/sync-events', requireCsrf, requirePermission('accounting.create'), validateBody(syncFinancialEventsSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const fromDate = new Date(req.body.fromDate);

    const [rules, events, existingJournals] = await Promise.all([
      req.tenantPrisma!.postingRule.findMany({ where: { isActive: true } }),
      req.tenantPrisma!.financialEvent.findMany({
        where: { createdAt: { gte: fromDate } },
        orderBy: { createdAt: 'asc' },
      }),
      req.tenantPrisma!.journalEntry.findMany({
        where: { sourceEventId: { not: null } },
        select: { sourceEventId: true },
      }),
    ]);

    const ruleByType = new Map(rules.map((r) => [r.eventType, r]));
    const postedIds = new Set(existingJournals.map((j) => j.sourceEventId));
    let postedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const ev of events) {
        if (postedIds.has(ev.id)) continue;
        const rule = ruleByType.get(ev.eventType);
        if (!rule) continue;
        const amount = Number(ev.amount);
        if (amount <= 0) continue;

        const journalNumber = await nextDocumentNumber(tx, schoolId, 'journal');
        await tx.journalEntry.create({
          data: {
            schoolId,
            journalNumber,
            entryDate: ev.createdAt,
            description: `Auto-post ${ev.eventType} (${ev.entityType})`,
            sourceEventId: ev.id,
            createdByUserId: req.auth!.userId,
            lines: {
              create: [
                { accountId: rule.debitAccountId, debit: amount, credit: 0 },
                { accountId: rule.creditAccountId, debit: 0, credit: amount },
              ],
            },
          },
        });
        postedCount++;
      }
    });

    res.json({ postedCount });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get('/statements', requirePermission('accounting.view'), async (req, res, next) => {
  try {
    const [accounts, lines] = await Promise.all([
      req.tenantPrisma!.account.findMany({ orderBy: { code: 'asc' } }),
      req.tenantPrisma!.journalEntryLine.findMany({
        where: { journalEntry: { status: 'posted' } },
      }),
    ]);

    const statements = computeFinancialStatements(
      accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type })),
      lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit) })),
    );
    res.json(statements);
  } catch (err) {
    next(err);
  }
});
