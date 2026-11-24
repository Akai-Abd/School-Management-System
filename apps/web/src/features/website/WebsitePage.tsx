import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useAuth } from '../../context/AuthContext';

interface WebsiteResponse {
  settings: {
    tagline: string | null;
    principalMessage: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    seoDescription: string | null;
  } | null;
  pages: Array<{ id: string; slug: string; title: string; status: string }>;
  announcements: Array<{ id: string; title: string; body: string; isPublished: boolean }>;
  events: Array<{ id: string; title: string; eventDate: string; description: string | null; isPublished: boolean }>;
}

export function WebsitePage() {
  const { activeMembership } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const webQuery = useQuery({
    queryKey: ['website'],
    queryFn: () => apiFetch<WebsiteResponse>('/api/v1/website'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['website'] });
  const onErr = (fallback: string) => (e: unknown) => setNotice(e instanceof ApiClientError ? e.message : fallback);

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/website/settings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Website settings updated.'); await invalidate(); },
    onError: onErr('Failed to update settings'),
  });

  const savePage = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/website/pages', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Website page saved.'); await invalidate(); },
    onError: onErr('Failed to save page'),
  });

  const addAnnouncement = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/website/announcements', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('News announcement published.'); await invalidate(); },
    onError: onErr('Failed to publish announcement'),
  });

  const addEvent = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/website/events', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Upcoming event added.'); await invalidate(); },
    onError: onErr('Failed to add event'),
  });

  if (webQuery.isLoading) return <LoadingState label="Loading school website..." />;
  if (webQuery.isError) return <ErrorState message="Could not load website CMS." />;

  const settings = webQuery.data?.settings;
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
        const opt = (k: string) => {
          const val = String(fd.get(k) ?? '').trim();
          return val ? val : undefined;
        };
        saveSettings.mutate({
          tagline: opt('tagline'),
          principalMessage: opt('principalMessage'),
          contactEmail: opt('contactEmail'),
          contactPhone: opt('contactPhone'),
          address: opt('address'),
          seoDescription: opt('seoDescription'),
        });
      }}>
        <h2 className="h6 mb-2">Landing Hero &amp; Contact Settings</h2>
        <div className="row g-2">
          <div className="col-md-6"><input name="tagline" className="form-control form-control-sm" placeholder="Hero Tagline" defaultValue={settings?.tagline ?? ''} /></div>
          <div className="col-md-3"><input name="contactEmail" type="email" className="form-control form-control-sm" placeholder="info@school.edu" defaultValue={settings?.contactEmail ?? ''} /></div>
          <div className="col-md-3"><input name="contactPhone" className="form-control form-control-sm" placeholder="+91-000-000-0000" defaultValue={settings?.contactPhone ?? ''} /></div>
          <div className="col-md-6"><input name="address" className="form-control form-control-sm" placeholder="School Campus Address" defaultValue={settings?.address ?? ''} /></div>
          <div className="col-md-6"><input name="seoDescription" className="form-control form-control-sm" placeholder="SEO Meta Description" defaultValue={settings?.seoDescription ?? ''} /></div>
          <div className="col-md-10"><textarea name="principalMessage" rows={2} className="form-control form-control-sm" placeholder="Principal / About message" defaultValue={settings?.principalMessage ?? ''} /></div>
          <div className="col-md-2 d-flex align-items-end"><button type="submit" className="btn btn-sm btn-primary w-100">Save Settings</button></div>
        </div>
      </form>

      <div className="row g-3">
        <div className="col-md-6">
          <form className="card border-0 shadow-sm p-3 h-100" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            addAnnouncement.mutate({
              title: String(fd.get('title') ?? ''),
              body: String(fd.get('body') ?? ''),
              isPublished: true,
            });
            e.currentTarget.reset();
          }}>
            <h2 className="h6 mb-2">Publish News Announcement</h2>
            <div className="d-flex flex-column gap-2">
              <input name="title" className="form-control form-control-sm" placeholder="Announcement title" required />
              <textarea name="body" rows={2} className="form-control form-control-sm" placeholder="Announcement summary..." required />
              <button type="submit" className="btn btn-sm btn-outline-primary align-self-start">Publish News</button>
            </div>
          </form>
        </div>

        <div className="col-md-6">
          <form className="card border-0 shadow-sm p-3 h-100" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const description = String(fd.get('description') ?? '').trim();
            addEvent.mutate({
              title: String(fd.get('title') ?? ''),
              eventDate: String(fd.get('eventDate') ?? ''),
              description: description || undefined,
              isPublished: true,
            });
            e.currentTarget.reset();
          }}>
            <h2 className="h6 mb-2">Add Upcoming Event</h2>
            <div className="d-flex flex-column gap-2">
              <div className="row g-2">
                <div className="col-7"><input name="title" className="form-control form-control-sm" placeholder="Event title" required /></div>
                <div className="col-5"><input name="eventDate" type="date" className="form-control form-control-sm" required /></div>
              </div>
              <textarea name="description" rows={2} className="form-control form-control-sm" placeholder="Event description (optional)" />
              <button type="submit" className="btn btn-sm btn-outline-primary align-self-start">Add Event</button>
            </div>
          </form>
        </div>
      </div>

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
        <h2 className="h6 mb-2">Publish Custom Page</h2>
        <div className="row g-2">
          <div className="col-md-3"><input name="slug" className="form-control form-control-sm" placeholder="about" defaultValue="about" required /></div>
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
