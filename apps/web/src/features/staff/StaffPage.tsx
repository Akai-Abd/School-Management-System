import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface StaffItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  status: string;
  isTeacher: boolean;
  department: { name: string } | null;
  designation: { name: string } | null;
}

export function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff', search],
    queryFn: () => apiFetch<{ items: StaffItem[]; total: number }>(`/api/v1/staff?search=${encodeURIComponent(search)}`),
  });

  const createStaff = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/v1/staff', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      setNotice('Staff member registered.');
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create staff'),
  });

  if (staffQuery.isLoading) return <LoadingState label="Loading staff directory..." />;
  if (staffQuery.isError) return <ErrorState message="Could not load staff." onRetry={() => void staffQuery.refetch()} />;

  const items = staffQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <h1 className="h3 mb-0">Staff & Teachers</h1>
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: 260 }}
          placeholder="Search name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form
        className="card border-0 shadow-sm p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          createStaff.mutate({
            fullName: String(fd.get('fullName') ?? ''),
            email: String(fd.get('email') ?? '') || undefined,
            joiningDate: String(fd.get('joiningDate') ?? ''),
            isTeacher: fd.get('isTeacher') === 'on',
            qualifications: String(fd.get('qualifications') ?? '') || undefined,
          });
          e.currentTarget.reset();
        }}
      >
        <h2 className="h6 mb-3">Register Employee</h2>
        <div className="row g-2 align-items-center">
          <div className="col-md-3"><input name="fullName" className="form-control form-control-sm" placeholder="Full Name" required /></div>
          <div className="col-md-3"><input name="email" type="email" className="form-control form-control-sm" placeholder="Email (optional)" /></div>
          <div className="col-md-2"><input name="joiningDate" type="date" className="form-control form-control-sm" required /></div>
          <div className="col-md-2"><input name="qualifications" className="form-control form-control-sm" placeholder="Qualifications" /></div>
          <div className="col-md-2 d-flex gap-2 align-items-center">
            <label className="form-check-label small text-nowrap">
              <input type="checkbox" name="isTeacher" className="form-check-input me-1" /> Teacher
            </label>
            <button type="submit" className="btn btn-sm btn-primary ms-auto" disabled={createStaff.isPending}>Add</button>
          </div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        {items.length === 0 ? (
          <EmptyState title="No Staff Members" description="Register employees or teachers above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td><code>{s.employeeCode}</code></td>
                  <td>{s.fullName}</td>
                  <td>{s.email ?? '—'}</td>
                  <td>{s.isTeacher ? 'Teacher' : 'Staff'}</td>
                  <td><span className="badge text-bg-secondary">{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
