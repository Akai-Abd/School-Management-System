import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

export function OnlineExamsPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const banksQuery = useQuery({ queryKey: ['online-exams', 'banks'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; questions: Array<{ id: string }> }> }>('/api/v1/online-exams/banks') });
  const examsQuery = useQuery({ queryKey: ['online-exams'], queryFn: () => apiFetch<{ items: Array<{ id: string; title: string; durationMinutes: number; startsAt: string; endsAt: string; attempts: Array<{ id: string }> }> }>('/api/v1/online-exams') });
  const subjectsQuery = useQuery({ queryKey: ['academic', 'subjects'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/subjects') });

  const createBank = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/online-exams/banks', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Question bank created.'); await queryClient.invalidateQueries({ queryKey: ['online-exams'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create bank'),
  });

  if (banksQuery.isLoading || examsQuery.isLoading) return <LoadingState label="Loading online examinations..." />;
  if (banksQuery.isError || examsQuery.isError) return <ErrorState message="Could not load online exams." />;

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Online Examinations</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form className="card border-0 shadow-sm p-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        createBank.mutate({ subjectId: String(fd.get('subjectId') ?? ''), name: String(fd.get('name') ?? '') });
        e.currentTarget.reset();
      }}>
        <h2 className="h6 mb-2">Create Question Bank</h2>
        <div className="row g-2">
          <div className="col-md-4">
            <select name="subjectId" className="form-select form-select-sm" required>
              <option value="">Subject...</option>
              {(subjectsQuery.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-6"><input name="name" className="form-control form-control-sm" placeholder="Unit 1 Question Bank" required /></div>
          <div className="col-md-2"><button type="submit" className="btn btn-sm btn-primary w-100">Create</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Question Banks ({banksQuery.data?.items.length ?? 0}) & Scheduled Online Exams</h2>
        {!(examsQuery.data?.items.length) ? (
          <EmptyState title="No Online Exams Scheduled" description="Add questions to a bank and schedule via /api/v1/online-exams." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Title</th><th>Duration</th><th>Window</th><th>Attempts</th></tr></thead>
            <tbody>
              {examsQuery.data.items.map((ex) => (
                <tr key={ex.id}>
                  <td>{ex.title}</td>
                  <td>{ex.durationMinutes} min</td>
                  <td className="small">{ex.startsAt.slice(0, 16)} → {ex.endsAt.slice(0, 16)}</td>
                  <td>{ex.attempts.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
