import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface ExamItem {
  id: string;
  name: string;
  category: string;
  isPublished: boolean;
  examSubjects: Array<{ id: string; maxMarks: string; passingMarks: string }>;
}

export function ExamsPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<{ items: ExamItem[] }>('/api/v1/exams'),
  });
  const yearsQuery = useQuery({
    queryKey: ['academic', 'years'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/v1/academic/years'),
  });

  const createExam = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/exams', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Exam created.');
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create exam'),
  });

  const publishExam = useMutation({
    mutationFn: (examId: string) => apiFetch(`/api/v1/exams/${examId}/publish`, { method: 'POST' }),
    onSuccess: async () => {
      setNotice('Exam results published.');
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  if (examsQuery.isLoading) return <LoadingState label="Loading examinations..." />;
  if (examsQuery.isError) return <ErrorState message="Could not load examinations." />;

  const exams = examsQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Examinations & Results</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form
        className="card border-0 shadow-sm p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          createExam.mutate({
            academicYearId: String(fd.get('academicYearId') ?? ''),
            name: String(fd.get('name') ?? ''),
            category: String(fd.get('category') ?? ''),
          });
          e.currentTarget.reset();
        }}
      >
        <h2 className="h6 mb-2">Create Examination</h2>
        <div className="row g-2">
          <div className="col-md-4">
            <select name="academicYearId" className="form-select form-select-sm" required>
              <option value="">Academic Year...</option>
              {(yearsQuery.data?.items ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="col-md-4"><input name="name" className="form-control form-control-sm" placeholder="Mid-Term 2026" required /></div>
          <div className="col-md-2"><input name="category" className="form-control form-control-sm" placeholder="mid_term" required /></div>
          <div className="col-md-2"><button type="submit" className="btn btn-sm btn-primary w-100">Create</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        {exams.length === 0 ? (
          <EmptyState title="No Examinations" description="Create an examination above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Exam</th><th>Category</th><th>Subjects</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {exams.map((ex) => (
                <tr key={ex.id}>
                  <td>{ex.name}</td>
                  <td>{ex.category}</td>
                  <td>{ex.examSubjects.length}</td>
                  <td><span className={`badge ${ex.isPublished ? 'bg-success' : 'text-bg-secondary'}`}>{ex.isPublished ? 'Published' : 'Draft'}</span></td>
                  <td>
                    {!ex.isPublished && (
                      <button type="button" className="btn btn-sm btn-outline-primary py-0" onClick={() => publishExam.mutate(ex.id)}>
                        Publish Results
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
