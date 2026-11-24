import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  submissions: Array<{ id: string }>;
}

export function HomeworkPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const hwQuery = useQuery({
    queryKey: ['homework'],
    queryFn: () => apiFetch<{ items: HomeworkItem[] }>('/api/v1/homework'),
  });
  const yearsQuery = useQuery({ queryKey: ['academic', 'years'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/years') });
  const classesQuery = useQuery({ queryKey: ['academic', 'classes'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }> }>('/api/v1/academic/classes') });
  const subjectsQuery = useQuery({ queryKey: ['academic', 'subjects'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/subjects') });

  const createHw = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/homework', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Homework assigned.'); await queryClient.invalidateQueries({ queryKey: ['homework'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create homework'),
  });

  if (hwQuery.isLoading) return <LoadingState label="Loading homework..." />;
  if (hwQuery.isError) return <ErrorState message="Could not load homework." />;

  const items = hwQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Homework & Assignments</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form
        className="card border-0 shadow-sm p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          createHw.mutate({
            academicYearId: String(fd.get('academicYearId') ?? ''),
            sectionId: String(fd.get('sectionId') ?? ''),
            subjectId: String(fd.get('subjectId') ?? ''),
            title: String(fd.get('title') ?? ''),
            description: String(fd.get('description') ?? ''),
            dueDate: String(fd.get('dueDate') ?? ''),
          });
          e.currentTarget.reset();
        }}
      >
        <h2 className="h6 mb-2">Assign Homework</h2>
        <div className="row g-2">
          <div className="col-md-2">
            <select name="academicYearId" className="form-select form-select-sm" required>
              <option value="">Year...</option>
              {(yearsQuery.data?.items ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select name="sectionId" className="form-select form-select-sm" required>
              <option value="">Section...</option>
              {(classesQuery.data?.items ?? []).flatMap((c) => c.sections.map((s) => <option key={s.id} value={s.id}>{c.name}-{s.name}</option>))}
            </select>
          </div>
          <div className="col-md-2">
            <select name="subjectId" className="form-select form-select-sm" required>
              <option value="">Subject...</option>
              {(subjectsQuery.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-3"><input name="title" className="form-control form-control-sm" placeholder="Assignment title" required /></div>
          <div className="col-md-2"><input name="dueDate" type="date" className="form-control form-control-sm" required /></div>
          <div className="col-md-1"><button type="submit" className="btn btn-sm btn-primary w-100">Assign</button></div>
          <div className="col-12"><input name="description" className="form-control form-control-sm" placeholder="Instructions..." required /></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        {items.length === 0 ? (
          <EmptyState title="No Homework Assigned" description="Assignments created above appear here." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Title</th><th>Due Date</th><th>Submissions</th></tr>
            </thead>
            <tbody>
              {items.map((hw) => (
                <tr key={hw.id}>
                  <td>{hw.title}</td>
                  <td>{hw.dueDate.slice(0, 10)}</td>
                  <td>{hw.submissions.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
