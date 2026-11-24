import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  assertBalancedJournalLines,
  computeFinancialStatements,
} from '../src/modules/accounting/accounting.routes.js';

describe('Phase 3B double-entry accounting invariants and routes', () => {
  it('should reject unbalanced, negative, or single-line journal entries (M11-AC1)', () => {
    expect(() =>
      assertBalancedJournalLines([{ accountId: 'a1', debit: 100, credit: 0 }]),
    ).toThrow();

    expect(() =>
      assertBalancedJournalLines([
        { accountId: 'a1', debit: 100, credit: 0 },
        { accountId: 'a2', debit: 0, credit: 90 },
      ]),
    ).toThrow();

    expect(() =>
      assertBalancedJournalLines([
        { accountId: 'a1', debit: 100, credit: 0 },
        { accountId: 'a2', debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });

  it('should compute reconciled trial balance, P&L, and balance sheet (M11-AC4)', () => {
    const accounts = [
      { id: 'cash', code: '1000', name: 'Cash', type: 'asset' as const },
      { id: 'ar', code: '1100', name: 'Receivable', type: 'asset' as const },
      { id: 'inc', code: '4000', name: 'Fee Income', type: 'income' as const },
    ];
    const lines = [
      { accountId: 'ar', debit: 5000, credit: 0 },
      { accountId: 'inc', debit: 0, credit: 5000 },
      { accountId: 'cash', debit: 3000, credit: 0 },
      { accountId: 'ar', debit: 0, credit: 3000 },
    ];

    const res = computeFinancialStatements(accounts, lines);
    expect(res.incomeStatement.netIncome).toBe(5000);
    expect(res.balanceSheet.totalAssets).toBe(5000);
    expect(res.balanceSheet.totalEquityWithNetIncome).toBe(5000);
  });

  it('should expose Phase 3B accounting OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/accounting/accounts']).toBeDefined();
    expect(openapi.body.paths['/api/v1/accounting/journals']).toBeDefined();
    expect(openapi.body.paths['/api/v1/accounting/statements']).toBeDefined();

    expect((await request(app).get('/api/v1/accounting/statements')).status).toBe(401);
  });
});
