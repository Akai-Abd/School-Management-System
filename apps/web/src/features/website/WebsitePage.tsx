import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useAuth } from '../../context/AuthContext';

export function WebsitePage() {
  const { activeMembership } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const webQuery = useQuery({
    queryKey: ['website'],
    queryFn: () => apiFetch<{ pages: Array<{ id: string; slug: string; title: string; status: string }> }>('/api/v1/website'),
  });

  const savePage = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/website/pages', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Website page saved.'); await queryClient.invalidateQueries({ queryKey: ['website'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to save page'),
  });

  if (webQuery.isLoading) return <LoadingState label="Loading school website..." />;
  if (webQuery.isError) return <ErrorState message="Could not load website CMS." />;

  const publicUrl = activeMembership ? `/public/${activeMembership.schoolSlug}` : '/public/demo-school';

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <h1 className="h3 mb-0">Dynamic School Website (SSR)</h1>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">
          Open Public Site
        </a>
      </div>

      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form className="card border-0 shadow-sm p-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        savePage.mutate({
          slug: String(fd.get('slug') ?? 'home'),
          title: String(fd.get('title') ?? ''),
          contentHtml: String(fd.get('contentHtml') ?? ''),
          status: String(fd.get('status') ?? 'published'),
        });
        e.currentTarget.reset();
      }}>
        <h2 className="h6 mb-2">Publish Page</h2>
        <div className="row g-2">
          <div className="col-md-3"><input name="slug" className="form-control form-control-sm" placeholder="home" defaultValue="home" required /></div>
          <div className="col-md-5"><input name="title" className="form-control form-control-sm" placeholder="Page Title" required /></div>
          <div className="col-md-2">
            <select name="status" className="form-select form-select-sm">
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="col-md-2"><button type="submit" className="btn btn-sm btn-primary w-100">Save Page</button></div>
          <div className="col-12"><textarea name="contentHtml" rows={3} className="form-control form-control-sm" placeholder="<p>Welcome to our school!</p>" required /></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Website Pages</h2>
        {!(webQuery.data?.pages.length) ? (
          <EmptyState title="No Custom Pages" description="Create and publish a page above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Slug</th><th>Title</th><th>Status</th><th>Link</th></tr></thead>
            <tbody>
              {webQuery.data.pages.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.slug}</code></td>
                  <td>{p.title}</td>
                  <td><span className={`badge ${p.status === 'published' ? 'bg-success' : 'text-bg-secondary'}`}>{p.status}</span></td>
                  <td>{p.status === 'published' ? <a href={`${publicUrl}/${p.slug}`} target="_blank" rel="noreferrer">View</a> : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
