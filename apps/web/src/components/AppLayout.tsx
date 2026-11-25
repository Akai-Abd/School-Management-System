import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  icon: string;
  permission?: string;
  moduleKey?: string;
  saasAdminOnly?: boolean;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: 'bi-speedometer2' }],
  },
  {
    section: 'Academics',
    items: [
      { label: 'Academic Sessions', to: '/academic', icon: 'bi-calendar3', permission: 'academic.view', moduleKey: 'academic' },
      { label: 'Students', to: '/students', icon: 'bi-people', permission: 'students.view', moduleKey: 'students' },
      { label: 'Attendance', to: '/attendance', icon: 'bi-calendar-check', permission: 'attendance.view', moduleKey: 'attendance' },
      { label: 'Timetable', to: '/timetable', icon: 'bi-table', permission: 'timetable.view', moduleKey: 'timetable' },
      { label: 'Examinations', to: '/exams', icon: 'bi-journal-check', permission: 'exams.view', moduleKey: 'exams' },
      { label: 'Online Exams', to: '/online-exams', icon: 'bi-laptop', permission: 'exams.view', moduleKey: 'online_exams' },
      { label: 'Homework', to: '/homework', icon: 'bi-book', permission: 'homework.view', moduleKey: 'homework' },
    ],
  },
  {
    section: 'Campus',
    items: [
      { label: 'Library', to: '/library', icon: 'bi-bookshelf', permission: 'library.view', moduleKey: 'library' },
      { label: 'Transport', to: '/transport', icon: 'bi-bus-front', permission: 'transport.view', moduleKey: 'transport' },
      { label: 'Hostel', to: '/hostel', icon: 'bi-building', permission: 'hostel.view', moduleKey: 'hostel' },
    ],
  },
  {
    section: 'Finance & HR',
    items: [
      { label: 'Fees & Billing', to: '/fees', icon: 'bi-receipt', permission: 'fees.view', moduleKey: 'fees' },
      { label: 'Accounting', to: '/accounting', icon: 'bi-journal-richtext', permission: 'accounting.view', moduleKey: 'accounting' },
      { label: 'Staff Records', to: '/staff', icon: 'bi-person-badge', permission: 'staff.view', moduleKey: 'staff' },
    ],
  },
  {
    section: 'Configuration',
    items: [
      { label: 'School Settings', to: '/settings', icon: 'bi-gear', permission: 'schools.view' },
      { label: 'Website Manager', to: '/website', icon: 'bi-globe', permission: 'website.view', moduleKey: 'website' },
      { label: 'Notifications', to: '/notifications', icon: 'bi-bell', moduleKey: 'communications' },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Schools', to: '/platform', icon: 'bi-buildings', saasAdminOnly: true },
      { label: 'Users & Admins', to: '/settings?tab=users', icon: 'bi-people-fill', permission: 'users.view' },
      { label: 'Roles & Permissions', to: '/settings?tab=roles', icon: 'bi-shield-check', permission: 'roles.view' },
      { label: 'Audit Logs', to: '/settings?tab=audit', icon: 'bi-clipboard-check', permission: 'audit_logs.view' },
    ],
  },
];

const SYSTEM_SETTINGS_TABS = new Set(['users', 'roles', 'audit']);

export function AppLayout() {
  const { session, activeMembership, logout, switchSchool, hasPermission, isModuleEnabled } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSaasAdmin = session?.appMode === 'saas' && session.user.isPlatformAdmin;
  const visibleGroups = NAV_GROUPS.map((group) => ({
    section: group.section,
    items: group.items.filter(
      (item) =>
        (!item.saasAdminOnly || isSaasAdmin) &&
        (!item.permission || hasPermission(item.permission)) &&
        (!item.moduleKey || isModuleEnabled(item.moduleKey)),
    ),
  })).filter((group) => group.items.length > 0);

  const searchTab = new URLSearchParams(location.search).get('tab');
  const effectiveKey =
    location.pathname === '/settings' && searchTab && SYSTEM_SETTINGS_TABS.has(searchTab)
      ? `/settings?tab=${searchTab}`
      : location.pathname;

  const allItems = visibleGroups.flatMap((g) => g.items);
  const currentItem = allItems.find((item) => item.to === effectiveKey);
  const pageTitle = currentItem?.label ?? 'Dashboard';
  const publicUrl = activeMembership ? `/public/${activeMembership.schoolSlug}` : '/public/demo-school';
  const initials = (session?.user.fullName ?? 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Sidebar navigation">
        <div className="sidebar-brand">
          <img src="/assets/images/logo.svg" alt="EduNexa" />
          <div>
            <div className="brand-name">EduNexa</div>
            <div className="brand-sub">{activeMembership?.schoolName ?? 'School ERP'}</div>
          </div>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Primary navigation">
            {visibleGroups.map((group) => (
              <div key={group.section}>
                <div className="sidebar-section">{group.section}</div>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={effectiveKey === item.to ? 'active' : undefined}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-decoration-none text-reset">
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
            Public School Website
          </a>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-btn d-lg-none"
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <i className="bi bi-list fs-5" />
          </button>

          <div className="page-heading">
            <h1>{pageTitle}</h1>
            <div className="crumbs">
              <Link to="/">Home</Link>
              {location.pathname !== '/' && (
                <>
                  <span className="sep">/</span>
                  <span>{pageTitle}</span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-actions">
            {session && session.memberships.length > 0 && (
              <select
                className="form-select form-select-sm me-2"
                aria-label="Active school"
                style={{ width: 'auto', maxWidth: 210 }}
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

            <div className="profile-btn d-none d-sm-flex">
              <span className="avatar avatar-sm">{initials}</span>
              <div className="profile-meta">
                <strong>{session?.user.fullName}</strong>
                <span>{activeMembership?.roles[0] ?? 'User'}</span>
              </div>
            </div>

            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void handleSignOut()}>
              <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>

        <footer className="page-footer d-flex justify-content-between align-items-center">
          <span>&copy; {new Date().getFullYear()} EduNexa School Management System</span>
          <span>{activeMembership?.schoolName ?? 'Standalone'}</span>
        </footer>
      </div>
    </div>
  );
}
