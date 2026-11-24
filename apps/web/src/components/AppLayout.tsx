import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  icon: string;
  permission?: string;
  moduleKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: 'bi-speedometer2' },
  { label: 'Academic', to: '/academic', icon: 'bi-diagram-3', permission: 'academic.view', moduleKey: 'academic' },
  { label: 'Students', to: '/students', icon: 'bi-people', permission: 'students.view', moduleKey: 'students' },
  { label: 'Staff', to: '/staff', icon: 'bi-person-badge', permission: 'staff.view', moduleKey: 'staff' },
  { label: 'Attendance', to: '/attendance', icon: 'bi-calendar-check', permission: 'attendance.view', moduleKey: 'attendance' },
  { label: 'Timetable', to: '/timetable', icon: 'bi-table', permission: 'timetable.view', moduleKey: 'timetable' },
  { label: 'Examinations', to: '/exams', icon: 'bi-journal-check', permission: 'exams.view', moduleKey: 'exams' },
  { label: 'Online Exams', to: '/online-exams', icon: 'bi-laptop', permission: 'exams.view', moduleKey: 'online_exams' },
  { label: 'Homework', to: '/homework', icon: 'bi-book', permission: 'homework.view', moduleKey: 'homework' },
  { label: 'Fees & Billing', to: '/fees', icon: 'bi-receipt', permission: 'fees.view', moduleKey: 'fees' },
  { label: 'Accounting', to: '/accounting', icon: 'bi-journal-richtext', permission: 'accounting.view', moduleKey: 'accounting' },
  { label: 'Library', to: '/library', icon: 'bi-bookshelf', permission: 'library.view', moduleKey: 'library' },
  { label: 'Transport', to: '/transport', icon: 'bi-bus-front', permission: 'transport.view', moduleKey: 'transport' },
  { label: 'Hostel', to: '/hostel', icon: 'bi-building', permission: 'hostel.view', moduleKey: 'hostel' },
  { label: 'Website', to: '/website', icon: 'bi-globe', permission: 'website.view', moduleKey: 'website' },
  { label: 'Notifications', to: '/notifications', icon: 'bi-bell', moduleKey: 'communications' },
  { label: 'Settings', to: '/settings', icon: 'bi-gear', permission: 'schools.view' },
];

export function AppLayout() {
  const { session, activeMembership, logout, switchSchool, hasPermission, isModuleEnabled } = useAuth();
  const location = useLocation();

  const visibleNav = NAV_ITEMS.filter(
    (item) =>
      (!item.permission || hasPermission(item.permission)) &&
      (!item.moduleKey || isModuleEnabled(item.moduleKey)),
  );
  if (session?.appMode === 'saas' && session.user.isPlatformAdmin) {
    visibleNav.push({ label: 'Platform', to: '/platform', icon: 'bi-buildings' });
  }

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
