import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Journal {
  id: string;
  journalNumber: string;
  entryDate: string;
  description: string;
  status: string;
}

interface StatementsResponse {
  trialBalance: Array<{ id: string; code: string; name: string; type: string; debit: number; credit: number }>;
  incomeStatement: { totalIncome: number; totalExpense: number; netIncome: number };
  balanceSheet: { totalAssets: number; totalLiabilities: number; totalEquityWithNetIncome: number };
}

export function AccountingPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const accountsQuery = useQuery({ queryKey: ['accounting', 'accounts'], queryFn: () => apiFetch<{ items: Account[] }>('/api/v1/accounting/accounts') });
  const journalsQuery = useQuery({ queryKey: ['accounting', 'journals'], queryFn: () => apiFetch<{ items: Journal[] }>('/api/v1/accounting/journals') });
  const statementsQuery = useQuery({ queryKey: ['accounting', 'statements'], queryFn: () => apiFetch<StatementsResponse>('/api/v1/accounting/statements') });

  const seedDefaults = useMutation({
    mutationFn: () => apiFetch('/api/v1/accounting/accounts/seed-defaults', { method: 'POST' }),
    onSuccess: async () => { setNotice('Default chart of accounts and posting rules seeded.'); await queryClient.invalidateQueries({ queryKey: ['accounting'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to seed accounts'),
  });

  const syncEvents = useMutation({
    mutationFn: () => apiFetch<{ postedCount: number }>('/api/v1/accounting/sync-events', { method: 'POST', body: JSON.stringify({ fromDate: '2026-01-01' }) }),
    onSuccess: async (r) => { setNotice(`Synced ${r.postedCount} financial event(s) to ledger.`); await queryClient.invalidateQueries({ queryKey: ['accounting'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Sync failed'),
  });

  const reverseJournal = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/accounting/journals/${id}/reverse`, { method: 'POST' }),
    onSuccess: async () => { setNotice('Reversal journal entry posted.'); await queryClient.invalidateQueries({ queryKey: ['accounting'] }); },
  });

  if (accountsQuery.isLoading || statementsQuery.isLoading) return <LoadingState label="Loading accounting ledger..." />;
  if (accountsQuery.isError || statementsQuery.isError) return <ErrorState message="Could not load accounting data." />;

  const st = statementsQuery.data;

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <h1 className="h3 mb-0">General Ledger & Accounting</h1>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => seedDefaults.mutate()}>Seed Default Accounts</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => syncEvents.mutate()}>Sync Financial Events</button>
        </div>
      </div>

      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      {st && (
        <div className="row g-3">
          <div className="col-md-4"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Net Income (P&L)</div><div className="h5 mb-0">{st.incomeStatement.netIncome}</div></div></div>
          <div className="col-md-4"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Total Assets</div><div className="h5 mb-0">{st.balanceSheet.totalAssets}</div></div></div>
          <div className="col-md-4"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Liabilities + Equity</div><div className="h5 mb-0">{st.balanceSheet.totalLiabilities + st.balanceSheet.totalEquityWithNetIncome}</div></div></div>
        </div>
      )}

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Trial Balance</h2>
        {!(st?.trialBalance.length) ? (
          <EmptyState title="No Accounts" description="Click 'Seed Default Accounts' to initialize the chart of accounts." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
              {st.trialBalance.map((a) => (
                <tr key={a.id}>
                  <td><code>{a.code}</code></td>
                  <td>{a.name}</td>
                  <td className="text-capitalize">{a.type}</td>
                  <td>{a.debit}</td>
                  <td>{a.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Posted Journals</h2>
        {!(journalsQuery.data?.items.length) ? (
          <EmptyState title="No Journal Entries" description="Sync fee events or post manual journals." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Journal #</th><th>Date</th><th>Description</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {journalsQuery.data.items.map((j) => (
                <tr key={j.id}>
                  <td><code>{j.journalNumber}</code></td>
                  <td>{j.entryDate.slice(0, 10)}</td>
                  <td>{j.description}</td>
                  <td><span className="badge text-bg-secondary">{j.status}</span></td>
                  <td>
                    {j.status === 'posted' && (
                      <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => reverseJournal.mutate(j.id)}>
                        Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
