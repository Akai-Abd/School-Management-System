import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  icon: string;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: 'bi-speedometer2' },
  { label: 'Students', to: '/students', icon: 'bi-people', permission: 'students.view' },
  { label: 'Staff', to: '/staff', icon: 'bi-person-badge', permission: 'staff.view' },
  { label: 'Attendance', to: '/attendance', icon: 'bi-calendar-check', permission: 'attendance.view' },
  { label: 'Examinations', to: '/exams', icon: 'bi-journal-check', permission: 'exams.view' },
  { label: 'Fees & Billing', to: '/fees', icon: 'bi-receipt', permission: 'fees.view' },
  { label: 'Settings', to: '/settings', icon: 'bi-gear', permission: 'schools.view' },
];

export function AppLayout() {
  const { session, activeMembership, logout, switchSchool, hasPermission } = useAuth();
  const location = useLocation();

  const visibleNav = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  const sidebarContent = (
    <nav className="nav flex-column gap-1 p-3" aria-label="Primary navigation">
      {visibleNav.map((item) => {
        const isActive = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-link d-flex align-items-center gap-2 rounded px-3 py-2 ${
              isActive ? 'bg-primary text-white fw-semibold' : 'text-dark'
            }`}
          >
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-vh-100 d-flex flex-column">
      <header className="navbar navbar-expand-lg bg-white border-bottom sticky-top px-3">
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary d-lg-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#mobileSidebar"
            aria-label="Toggle navigation"
          >
            <i className="bi bi-list" />
          </button>
          <span className="navbar-brand mb-0 h1 fs-5 fw-bold text-primary">School ERP</span>
        </div>

        <div className="ms-auto d-flex align-items-center gap-3">
          {session && session.memberships.length > 0 && (
            <select
              className="form-select form-select-sm"
              aria-label="Active school"
              value={session.activeSchoolId ?? ''}
              onChange={(e) => void switchSchool(e.target.value || null)}
            >
              {session.memberships.map((m) => (
                <option key={m.schoolId} value={m.schoolId}>
                  {m.schoolName}
                </option>
              ))}
            </select>
          )}
          <span className="small text-muted d-none d-md-inline">
            {session?.user.fullName}
            {activeMembership?.roles[0] ? ` (${activeMembership.roles[0]})` : ''}
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="container-fluid flex-grow-1">
        <div className="row min-vh-100">
          <aside className="col-lg-2 d-none d-lg-block bg-white border-end p-0">{sidebarContent}</aside>
          <main className="col-lg-10 p-4">
            <nav aria-label="breadcrumb" className="mb-3">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to="/">Home</Link>
                </li>
                {location.pathname !== '/' && (
                  <li className="breadcrumb-item active text-capitalize" aria-current="page">
                    {location.pathname.replace('/', '')}
                  </li>
                )}
              </ol>
            </nav>
            <Outlet />
          </main>
        </div>
      </div>

      <div className="offcanvas offcanvas-start" tabIndex={-1} id="mobileSidebar" aria-label="Mobile menu">
        <div className="offcanvas-header border-bottom">
          <h5 className="offcanvas-title">School ERP</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close" />
        </div>
        <div className="offcanvas-body p-0">{sidebarContent}</div>
      </div>
    </div>
  );
}
