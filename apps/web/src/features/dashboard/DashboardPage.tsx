import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/States';

interface PortalResponse {
  students: Array<{
    id: string;
    admissionNumber: string;
    name: string;
    enrollment: string;
    attendanceSummary: { total: number; present: number };
    publishedResultsCount: number;
    invoices: Array<{ id: string }>;
  }>;
}

interface DashboardSummaryResponse {
  roles: string[];
  metrics: {
    totalStudents: number;
    totalStaff: number;
    pendingLeaves: number;
    feeCollected: number;
    feeOutstanding: number;
    totalBooks: number;
    availableBookCopies: number;
    activeRoutes: number;
    occupiedBeds: number;
    totalBeds: number;
  };
}

export function DashboardPage() {
  const { session, activeMembership } = useAuth();
  const isPortalRole = Boolean(
    activeMembership?.roles.some((r) => r === 'parent' || r === 'student'),
  );

  const summaryQuery = useQuery({
    queryKey: ['dashboards', 'summary'],
    queryFn: () => apiFetch<DashboardSummaryResponse>('/api/v1/dashboards/summary'),
    enabled: Boolean(activeMembership),
  });

  const portalQuery = useQuery({
    queryKey: ['me', 'portal'],
    queryFn: () => apiFetch<PortalResponse>('/api/v1/me/portal'),
    enabled: isPortalRole && Boolean(activeMembership),
  });

  if (!activeMembership && !session?.user.isPlatformAdmin) {
    return (
      <EmptyState
        title="No Active School Context"
        description="Your account is not assigned to an active school yet. Contact your administrator."
      />
    );
  }

  const m = summaryQuery.data?.metrics;

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 mb-0">Dashboard</h1>
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small">Active School</div>
              <div className="h5 mt-1 mb-0">{activeMembership?.schoolName ?? 'Platform Mode'}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small">Assigned Roles</div>
              <div className="h5 mt-1 mb-0">{activeMembership?.roles.join(', ') || 'Super Admin'}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small">MFA Status</div>
              <div className="h5 mt-1 mb-0">{session?.user.mfaEnabled ? 'Enabled' : 'Not Configured'}</div>
            </div>
          </div>
        </div>
      </div>

      {m && !isPortalRole && (
        <div className="row g-3">
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Active Students</div><div className="h5 mb-0">{m.totalStudents}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Active Staff</div><div className="h5 mb-0">{m.totalStaff}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Fees Collected</div><div className="h5 mb-0 text-success">{m.feeCollected}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Pending Leaves</div><div className="h5 mb-0">{m.pendingLeaves}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Fees Outstanding</div><div className="h5 mb-0 text-danger">{m.feeOutstanding}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Library Copies Avail</div><div className="h5 mb-0">{m.availableBookCopies} ({m.totalBooks} titles)</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Transport Routes</div><div className="h5 mb-0">{m.activeRoutes}</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm p-3"><div className="small text-muted">Hostel Occupancy</div><div className="h5 mb-0">{m.occupiedBeds}/{m.totalBeds}</div></div></div>
        </div>
      )}

      {isPortalRole && (portalQuery.data?.students.length ?? 0) > 0 && (
        <div className="card border-0 shadow-sm p-3">
          <h2 className="h5 mb-3">Student & Parent Portal Summary</h2>
          <div className="row g-3">
            {portalQuery.data!.students.map((st) => (
              <div className="col-md-6" key={st.id}>
                <div className="border rounded p-3">
                  <div className="fw-semibold">{st.name} (<code>{st.admissionNumber}</code>)</div>
                  <div className="small text-muted mb-2">{st.enrollment}</div>
                  <div className="small">Attendance: {st.attendanceSummary.present}/{st.attendanceSummary.total}</div>
                  <div className="small">Published Exam Results: {st.publishedResultsCount}</div>
                  <div className="small">Invoices: {st.invoices.length}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
