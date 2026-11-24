import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

export function PlatformPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const schoolsQuery = useQuery({
    queryKey: ['platform', 'schools'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; slug: string; status: string; _count: { memberships: number } }> }>('/api/v1/platform/schools'),
  });

  const onboardSchool = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/platform/schools', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('School onboarded.'); await queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Onboarding failed'),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      apiFetch(`/api/v1/platform/schools/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] }); },
  });

  if (schoolsQuery.isLoading) return <LoadingState label="Loading SaaS schools..." />;
  if (schoolsQuery.isError) return <ErrorState message="Platform routes require SaaS Super Admin mode." />;

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">SaaS Platform Administration</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form className="card border-0 shadow-sm p-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onboardSchool.mutate({
          name: String(fd.get('name') ?? ''),
          slug: String(fd.get('slug') ?? ''),
          adminName: String(fd.get('adminName') ?? ''),
          adminEmail: String(fd.get('adminEmail') ?? ''),
          adminPassword: String(fd.get('adminPassword') ?? ''),
        });
        e.currentTarget.reset();
      }}>
        <h2 className="h6 mb-2">Onboard New School</h2>
        <div className="row g-2">
          <div className="col-md-3"><input name="name" className="form-control form-control-sm" placeholder="School Name" required /></div>
          <div className="col-md-2"><input name="slug" className="form-control form-control-sm" placeholder="school-slug" required /></div>
          <div className="col-md-2"><input name="adminName" className="form-control form-control-sm" placeholder="Admin Name" required /></div>
          <div className="col-md-2"><input name="adminEmail" type="email" className="form-control form-control-sm" placeholder="Admin Email" required /></div>
          <div className="col-md-2"><input name="adminPassword" type="password" minLength={10} className="form-control form-control-sm" placeholder="Temp Password" required /></div>
          <div className="col-md-1"><button type="submit" className="btn btn-sm btn-primary w-100">Add</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        {!(schoolsQuery.data?.items.length) ? (
          <EmptyState title="No Schools" description="Onboard a school above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>School</th><th>Slug</th><th>Members</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {schoolsQuery.data.items.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><code>{s.slug}</code></td>
                  <td>{s._count.memberships}</td>
                  <td>{s.status}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() => toggleStatus.mutate({ id: s.id, status: s.status === 'active' ? 'suspended' : 'active' })}
                    >
                      {s.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
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
