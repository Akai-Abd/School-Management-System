import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

export function TransportPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const vehiclesQuery = useQuery({ queryKey: ['transport', 'vehicles'], queryFn: () => apiFetch<{ items: Array<{ id: string; registrationNumber: string; capacity: number }> }>('/api/v1/transport/vehicles') });
  const routesQuery = useQuery({ queryKey: ['transport', 'routes'], queryFn: () => apiFetch<{ items: Array<{ id: string; name: string; vehicle: { registrationNumber: string } | null; stops: Array<{ id: string; name: string }>; assignments: Array<{ id: string }> }> }>('/api/v1/transport/routes') });

  const addVehicle = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/v1/transport/vehicles', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => { setNotice('Vehicle added.'); await queryClient.invalidateQueries({ queryKey: ['transport'] }); },
    onError: (e) => setNotice(e instanceof ApiClientError ? e.message : 'Failed to add vehicle'),
  });

  if (vehiclesQuery.isLoading || routesQuery.isLoading) return <LoadingState label="Loading transport..." />;
  if (vehiclesQuery.isError || routesQuery.isError) return <ErrorState message="Could not load transport data." />;

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Transportation Management</h1>
      {notice && <div className="alert alert-info py-2 mb-0">{notice}</div>}

      <form className="card border-0 shadow-sm p-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        addVehicle.mutate({ registrationNumber: String(fd.get('reg') ?? ''), capacity: Number(fd.get('cap') ?? 30) });
        e.currentTarget.reset();
      }}>
        <h2 className="h6 mb-2">Register Vehicle</h2>
        <div className="row g-2">
          <div className="col-md-6"><input name="reg" className="form-control form-control-sm" placeholder="KA-01-AB-1234" required /></div>
          <div className="col-md-4"><input name="cap" type="number" min={1} className="form-control form-control-sm" placeholder="Capacity (40)" required /></div>
          <div className="col-md-2"><button type="submit" className="btn btn-sm btn-primary w-100">Add Vehicle</button></div>
        </div>
      </form>

      <div className="card border-0 shadow-sm p-3">
        <h2 className="h5 mb-3">Routes & Vehicles ({vehiclesQuery.data?.items.length ?? 0} vehicles)</h2>
        {!(routesQuery.data?.items.length) ? (
          <EmptyState title="No Routes" description="Create routes and stops via /api/v1/transport/routes." />
        ) : (
          <table className="table table-sm mb-0">
            <thead><tr><th>Route</th><th>Vehicle</th><th>Stops</th><th>Assigned Students</th></tr></thead>
            <tbody>
              {routesQuery.data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.vehicle?.registrationNumber ?? '—'}</td>
                  <td>{r.stops.map((s) => s.name).join(', ') || '—'}</td>
                  <td>{r.assignments.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
