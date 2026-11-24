import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const notifQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<{ items: NotificationItem[] }>('/api/v1/notifications'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  if (notifQuery.isLoading) return <LoadingState label="Loading notifications..." />;
  if (notifQuery.isError) return <ErrorState message="Could not load notifications." />;

  const items = notifQuery.data?.items ?? [];

  return (
    <div className="d-flex flex-column gap-3">
      <h1 className="h3 mb-0">Notifications</h1>
      <div className="card border-0 shadow-sm p-3">
        {items.length === 0 ? (
          <EmptyState title="All Caught Up" description="No notifications yet." />
        ) : (
          <ul className="list-group list-group-flush">
            {items.map((n) => (
              <li key={n.id} className="list-group-item d-flex justify-content-between align-items-start px-0">
                <div>
                  <div className={n.isRead ? 'text-muted' : 'fw-semibold'}>{n.title}</div>
                  <div className="small text-muted">{n.body}</div>
                </div>
                {!n.isRead && (
                  <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => markRead.mutate(n.id)}>
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
