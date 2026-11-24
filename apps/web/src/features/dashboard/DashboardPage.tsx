import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/States';

export function DashboardPage() {
  const { session, activeMembership } = useAuth();

  if (!activeMembership && !session?.user.isPlatformAdmin) {
    return (
      <EmptyState
        title="No Active School Context"
        description="Your account is not assigned to an active school yet. Contact your administrator."
      />
    );
  }

  return (
    <div>
      <h1 className="h3 mb-4">Dashboard</h1>
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
              <div className="text-muted small">Deployment Mode</div>
              <div className="h5 mt-1 mb-0 text-uppercase">{session?.appMode}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
