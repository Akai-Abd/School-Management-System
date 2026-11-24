import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface FeeSummary {
  totalInvoiced: number;
  totalCollected: number;
  totalRefunded: number;
  totalOutstanding: number;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  studentId: string;
  totalAmount: string;
  discountAmount: string;
  paidAmount: string;
  status: string;
  dueDate: string;
}

interface PaymentItem {
  id: string;
  receiptNumber: string;
  amount: string;
  mode: string;
  instrumentStatus: string;
  paymentDate: string;
}

interface RefundItem {
  id: string;
  paymentId: string;
  amount: string;
  reason: string;
  status: string;
}

export function FeesPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['fees', 'summary'],
    queryFn: () => apiFetch<FeeSummary>('/api/v1/fees/summary'),
  });
  const feeTypesQuery = useQuery({
    queryKey: ['fees', 'types'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; code: string }> }>('/api/v1/fees/fee-types'),
  });
  const invoicesQuery = useQuery({
    queryKey: ['fees', 'invoices'],
    queryFn: () => apiFetch<{ items: InvoiceItem[] }>('/api/v1/fees/invoices'),
  });
  const paymentsQuery = useQuery({
    queryKey: ['fees', 'payments'],
    queryFn: () => apiFetch<{ items: PaymentItem[] }>('/api/v1/fees/payments'),
  });
  const refundsQuery = useQuery({
    queryKey: ['fees', 'refunds'],
    queryFn: () => apiFetch<{ items: RefundItem[] }>('/api/v1/fees/refunds'),
  });
  const studentsQuery = useQuery({
    queryKey: ['students', 'fees'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; admissionNumber: string; firstName: string; lastName: string }> }>('/api/v1/students'),
  });
  const yearsQuery = useQuery({
    queryKey: ['academic', 'years'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/years'),
  });

  const createFeeType = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/fees/fee-types', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Fee type added.');
      await queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to add fee type'),
  });

  const createInvoice = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/fees/invoices', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Invoice generated.');
      await queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create invoice'),
  });

  const collectPayment = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/fees/payments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Payment collected.');
      await queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to collect payment'),
  });

  const bouncePayment = useMutation({
    mutationFn: (paymentId: string) => apiFetch(`/api/v1/fees/payments/${paymentId}/bounce`, { method: 'POST' }),
    onSuccess: async () => {
      setNotice('Cheque marked bounced and invoice allocations reversed.');
      await queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Could not reverse cheque'),
  });

  const decideRefund = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      apiFetch(`/api/v1/fees/refunds/${id}/decide`, { method: 'PATCH', body: JSON.stringify({ decision }) }),
    onSuccess: async () => {
      setNotice('Refund decision saved.');
      await queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Refund decision blocked'),
  });

  if (summaryQuery.isLoading || invoicesQuery.isLoading) return <LoadingState label="Loading fees & billing..." />;
  if (summaryQuery.isError || invoicesQuery.isError) return <ErrorState message="Could not load fee data." />;

  const summary = summaryQuery.data;
  const students = studentsQuery.data?.items ?? [];
  const years = yearsQuery.data?.items ?? [];
  const feeTypes = feeTypesQuery.data?.items ?? [];
  const invoices = invoicesQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Fees & Billing</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      {summary && (
        <div className="row g-3">
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Invoiced</div><div className="h5 mb-0">{summary.totalInvoiced}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Collected</div><div className="h5 mb-0 text-success">{summary.totalCollected}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Outstanding</div><div className="h5 mb-0 text-danger">{summary.totalOutstanding}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Refunded</div><div className="h5 mb-0">{summary.totalRefunded}</div></div></div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-4">
          <form
            className="card border-0 shadow-sm p-3 h-100"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createFeeType.mutate({ name: String(fd.get('name') ?? ''), code: String(fd.get('code') ?? '') });
              e.currentTarget.reset();
            }}
          >
            <h2 className="h6 mb-2">Fee Categories ({feeTypes.length})</h2>
            <div className="d-flex flex-column gap-2">
              <input name="name" className="form-control form-control-sm" placeholder="Tuition Fee" required />
              <input name="code" className="form-control form-control-sm" placeholder="TUITION" required />
              <button type="submit" className="btn btn-sm btn-primary">Add Fee Type</button>
            </div>
          </form>
        </div>

        <div className="col-lg-4">
          <form
            className="card border-0 shadow-sm p-3 h-100"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createInvoice.mutate({
                studentId: String(fd.get('studentId') ?? ''),
                academicYearId: String(fd.get('academicYearId') ?? ''),
                dueDate: String(fd.get('dueDate') ?? ''),
                items: [{ feeTypeId: String(fd.get('feeTypeId') ?? ''), description: 'Tuition', amount: Number(fd.get('amount') ?? 0) }],
              });
              e.currentTarget.reset();
            }}
          >
            <h2 className="h6 mb-2">Generate Invoice</h2>
            <div className="d-flex flex-column gap-2">
              <select name="studentId" className="form-select form-select-sm" required>
                <option value="">Student...</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNumber} - {s.firstName} {s.lastName}</option>)}
              </select>
              <div className="d-flex gap-2">
                <select name="academicYearId" className="form-select form-select-sm" required>
                  <option value="">Year...</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
                <select name="feeTypeId" className="form-select form-select-sm" required>
                  <option value="">Fee Type...</option>
                  {feeTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="d-flex gap-2">
                <input name="amount" type="number" step="0.01" min="1" className="form-control form-control-sm" placeholder="Amount" required />
                <input name="dueDate" type="date" className="form-control form-control-sm" required />
              </div>
              <button type="submit" className="btn btn-sm btn-primary">Create Invoice</button>
            </div>
          </form>
        </div>

        <div className="col-lg-4">
          <form
            className="card border-0 shadow-sm p-3 h-100"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const invoiceId = String(fd.get('invoiceId') ?? '');
              const inv = invoices.find((i) => i.id === invoiceId);
              const amount = Number(fd.get('amount') ?? 0);
              if (!inv) return;
              collectPayment.mutate({
                studentId: inv.studentId,
                paymentDate: String(fd.get('paymentDate') ?? new Date().toISOString().slice(0, 10)),
                amount,
                mode: String(fd.get('mode') ?? 'cash'),
                allocations: [{ invoiceId, amount }],
              });
              e.currentTarget.reset();
            }}
          >
            <h2 className="h6 mb-2">Collect Payment</h2>
            <div className="d-flex flex-column gap-2">
              <select name="invoiceId" className="form-select form-select-sm" required>
                <option value="">Unpaid / partial invoice...</option>
                {invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').map((i) => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber} (Due: {Number(i.totalAmount) - Number(i.discountAmount) - Number(i.paidAmount)})</option>
                ))}
              </select>
              <div className="d-flex gap-2">
                <input name="amount" type="number" step="0.01" min="1" className="form-control form-control-sm" placeholder="Amount" required />
                <select name="mode" className="form-select form-select-sm">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <input name="paymentDate" type="date" className="form-control form-control-sm" defaultValue={new Date().toISOString().slice(0, 10)} required />
              <button type="submit" className="btn btn-sm btn-success">Record Payment</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Invoices</h2>
        {!invoices.length ? (
          <EmptyState title="No Invoices" description="Generate an invoice above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Invoice #</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Status</th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><code>{inv.invoiceNumber}</code></td>
                  <td>{inv.dueDate.slice(0, 10)}</td>
                  <td>{inv.totalAmount}</td>
                  <td>{inv.paidAmount}</td>
                  <td><span className="badge text-bg-secondary">{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Receipts & Payments</h2>
        {!(paymentsQuery.data?.items.length) ? (
          <EmptyState title="No Payments" description="Collected payments and receipts appear here." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Receipt #</th><th>Date</th><th>Amount</th><th>Mode</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {paymentsQuery.data.items.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.receiptNumber}</code></td>
                  <td>{p.paymentDate.slice(0, 10)}</td>
                  <td>{p.amount}</td>
                  <td className="text-uppercase">{p.mode}</td>
                  <td><span className="badge text-bg-secondary">{p.instrumentStatus}</span></td>
                  <td className="d-flex gap-2">
                    <a className="btn btn-sm btn-outline-primary py-0" href={`/api/v1/fees/payments/${p.id}/receipt.pdf`}>PDF</a>
                    {p.mode === 'cheque' && p.instrumentStatus !== 'bounced' && (
                      <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => bouncePayment.mutate(p.id)}>
                        Mark Bounced
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(refundsQuery.data?.items.length ?? 0) > 0 && (
        <div className="card border-0 shadow-sm p-3">
          <h2 className="h5 mb-3">Refund Requests (Maker-Checker)</h2>
          <table className="table table-sm mb-0">
            <thead><tr><th>Amount</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {refundsQuery.data!.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.amount}</td>
                  <td>{r.reason}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="d-flex gap-1">
                        <button type="button" className="btn btn-sm btn-outline-success py-0" onClick={() => decideRefund.mutate({ id: r.id, decision: 'approved' })}>Approve</button>
                        <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => decideRefund.mutate({ id: r.id, decision: 'rejected' })}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
