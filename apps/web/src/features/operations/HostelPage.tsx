import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

export function HostelPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const hostelQuery = useQuery({
    queryKey: ['hostel'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; rooms: Array<{ id: string; roomNumber: string; capacity: number; beds: Array<{ id: string; bedCode: string; isOccupied: boolean }> }> }> }>('/api/v1/hostel'),
  });

  const addHostel = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/hostel', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Hostel building created.'); await queryClient.invalidateQueries({ queryKey: ['hostel'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to create hostel'),
  });

  if (hostelQuery.isLoading) return <LoadingState label="Loading hostels..." />;
  if (hostelQuery.isError) return <ErrorState message="Could not load hostel data." />;

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Hostel Management</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form className="card border-0 shadow-sm p-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        addHostel.mutate({ name: String(fd.get('name') ?? '') });
        e.currentTarget.reset();
      }}>
        <h2 className="h6 mb-2">Add Hostel Building</h2>
        <div className="row g-2">
          <div className="col-md-9"><input name="name" className="form-control form-control-sm" placeholder="Boys Hostel Block A" required /></div>
          <div className="col-md-3"><button type="submit" className="btn btn-sm btn-primary w-100">Add Hostel</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Buildings & Occupancy</h2>
        {!(hostelQuery.data?.items.length) ? (
          <EmptyState title="No Hostels" description="Add a hostel building above." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Hostel</th><th>Rooms</th><th>Occupied Beds</th></tr></thead>
            <tbody>
              {hostelQuery.data.items.map((h) => {
                const allBeds = h.rooms.flatMap((r) => r.beds);
                const occupied = allBeds.filter((b) => b.isOccupied).length;
                return (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>{h.rooms.length}</td>
                    <td>{occupied}/{allBeds.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
