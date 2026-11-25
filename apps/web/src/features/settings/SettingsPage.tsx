import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, ApiClientError } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useAuth } from '../../context/AuthContext';

interface SettingsResponse {
  school: { id: string; name: string; slug: string; status: string; timezone: string; currency: string };
  settings: {
    locale: string;
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    workingDays: string[];
    roundingPolicy: string;
    studentFeeViewEnabled: boolean;
    discountApprovalAmount: string | null;
  };
  modules: Array<{ moduleKey: string; isEnabled: boolean }>;
  sequences: Array<{ id: string; docType: string; scopeKey: string; prefix: string; nextNumber: number }>;
}

interface RoleItem {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissionCodes: string[];
}

interface UsersResponse {
  items: Array<{
    membershipId: string;
    status: string;
    user: { id: string; email: string; fullName: string; isActive: boolean };
    roles: Array<{ id: string; key: string; name: string }>;
  }>;
  pendingInvites: Array<{ id: string; email: string; roleId: string; expiresAt: string }>;
}

interface AuditResponse {
  items: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: { fullName: string; email: string } | null;
  }>;
  total: number;
}

type TabKey = 'general' | 'modules' | 'sequences' | 'roles' | 'users' | 'audit';
const VALID_TABS = new Set<TabKey>(['general', 'modules', 'sequences', 'roles', 'users', 'audit']);

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: TabKey = rawTab && VALID_TABS.has(rawTab as TabKey) ? (rawTab as TabKey) : 'general';
  const setTab = (next: TabKey) => setSearchParams(next === 'general' ? {} : { tab: next });
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsResponse>('/api/v1/settings'),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<{ items: RoleItem[] }>('/api/v1/roles'),
    enabled: tab === 'roles' || tab === 'users',
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UsersResponse>('/api/v1/users'),
    enabled: tab === 'users' && hasPermission('users.view'),
  });

  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiFetch<AuditResponse>('/api/v1/audit-logs?limit=25'),
    enabled: tab === 'audit' && hasPermission('audit_logs.view'),
  });

  const updateSettings = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setNotice('School settings saved.');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => setNotice(err instanceof ApiClientError ? err.message : 'Failed to save settings'),
  });

  const toggleModule = useMutation({
    mutationFn: (modules: Array<{ moduleKey: string; isEnabled: boolean }>) =>
      apiFetch('/api/v1/settings/modules', { method: 'PUT', body: JSON.stringify({ modules }) }),
    onSuccess: async () => {
      setNotice('Module configuration updated.');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const sendInvite = useMutation({
    mutationFn: () =>
      apiFetch<{ email: string; devInviteToken?: string }>('/api/v1/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, roleId: inviteRoleId }),
      }),
    onSuccess: async (res) => {
      setInviteEmail('');
      setNotice(
        res.devInviteToken
          ? `Invitation created for ${res.email}. Dev token: ${res.devInviteToken}`
          : `Invitation sent to ${res.email}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setNotice(err instanceof ApiClientError ? err.message : 'Failed to invite user'),
  });

  if (settingsQuery.isLoading) return <LoadingState label="Loading school settings..." />;
  if (settingsQuery.isError || !settingsQuery.data) {
    return <ErrorState message="Could not load school settings." onRetry={() => void settingsQuery.refetch()} />;
  }

  const { school, settings, modules, sequences } = settingsQuery.data;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">School Settings & Administration</h1>
        <a href="/api/v1/settings/export.json" className="btn btn-sm btn-outline-secondary">
          Export Full School Package
        </a>
      </div>

      {notice && (
        <div className="alert alert-info py-2 d-flex justify-content-between align-items-center" role="status">
          <span>{notice}</span>
          <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => setNotice(null)} />
        </div>
      )}

      <ul className="nav nav-tabs mb-4">
        {(
          [
            ['general', 'General'],
            ['modules', 'Modules'],
            ['sequences', 'Numbering'],
            ['roles', 'Roles'],
            ['users', 'Users & Invites'],
            ['audit', 'Audit Logs'],
          ] as Array<[TabKey, string]>
        ).map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link ${tab === key ? 'active fw-semibold' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'general' && (
        <form
          className="card border-0 shadow-sm p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            updateSettings.mutate({
              name: String(fd.get('name') ?? ''),
              timezone: String(fd.get('timezone') ?? ''),
              currency: String(fd.get('currency') ?? ''),
              dateFormat: String(fd.get('dateFormat') ?? 'DD/MM/YYYY'),
              studentFeeViewEnabled: fd.get('studentFeeViewEnabled') === 'on',
            });
          }}
        >
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="schoolName">School Name</label>
              <input id="schoolName" name="name" className="form-control" defaultValue={school.name} required />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="timezone">Timezone</label>
              <input id="timezone" name="timezone" className="form-control" defaultValue={school.timezone} required />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="currency">Currency</label>
              <input id="currency" name="currency" className="form-control" defaultValue={school.currency} maxLength={3} required />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="dateFormat">Date Format</label>
              <select id="dateFormat" name="dateFormat" className="form-select" defaultValue={settings.dateFormat}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="col-md-8 d-flex align-items-end">
              <div className="form-check">
                <input
                  id="studentFeeViewEnabled"
                  name="studentFeeViewEnabled"
                  type="checkbox"
                  className="form-check-input"
                  defaultChecked={settings.studentFeeViewEnabled}
                />
                <label className="form-check-label" htmlFor="studentFeeViewEnabled">
                  Allow students to view fee information (PRD D11)
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="btn btn-primary" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {tab === 'modules' && (
        <div className="card border-0 shadow-sm p-4">
          <p className="text-muted small">Disabling a module hides it and blocks API access without deleting data.</p>
          <div className="row g-2">
            {modules.map((m) => (
              <div className="col-md-4" key={m.moduleKey}>
                <div className="border rounded p-2 d-flex justify-content-between align-items-center">
                  <span className="text-capitalize">{m.moduleKey.replace('_', ' ')}</span>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={`Toggle ${m.moduleKey}`}
                    checked={m.isEnabled}
                    onChange={(e) =>
                      toggleModule.mutate([{ moduleKey: m.moduleKey, isEnabled: e.target.checked }])
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sequences' && (
        <div className="card border-0 shadow-sm p-4">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Prefix</th>
                <th>Next Number</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => (
                <tr key={seq.id}>
                  <td className="text-capitalize">{seq.docType}</td>
                  <td><code>{seq.prefix}</code></td>
                  <td>{seq.nextNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'roles' && (
        <div className="card border-0 shadow-sm p-4">
          {rolesQuery.isLoading ? (
            <LoadingState label="Loading roles..." />
          ) : (
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {(rolesQuery.data?.items ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td><code>{r.key}</code></td>
                    <td>{r.isSystem ? 'System' : 'Custom'}</td>
                    <td>{r.permissionCodes.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="card border-0 shadow-sm p-4">
          {hasPermission('users.create') && (
            <form
              className="row g-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                sendInvite.mutate();
              }}
            >
              <div className="col-md-5">
                <input
                  type="email"
                  className="form-control"
                  placeholder="Invite user email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  required
                >
                  <option value="">Select role...</option>
                  {(rolesQuery.data?.items ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <button type="submit" className="btn btn-primary w-100" disabled={sendInvite.isPending}>
                  Send Invite
                </button>
              </div>
            </form>
          )}
          {usersQuery.isLoading ? (
            <LoadingState label="Loading users..." />
          ) : !usersQuery.data?.items.length ? (
            <EmptyState title="No Users" description="No active school members found." />
          ) : (
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.items.map((u) => (
                  <tr key={u.membershipId}>
                    <td>{u.user.fullName}</td>
                    <td>{u.user.email}</td>
                    <td>{u.roles.map((r) => r.name).join(', ') || '—'}</td>
                    <td>{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card border-0 shadow-sm p-4">
          {auditQuery.isLoading ? (
            <LoadingState label="Loading audit logs..." />
          ) : !auditQuery.data?.items.length ? (
            <EmptyState title="No Audit Entries" description="Sensitive actions will appear here." />
          ) : (
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {auditQuery.data.items.map((log) => (
                  <tr key={log.id}>
                    <td className="small text-muted">{new Date(log.createdAt).toLocaleString()}</td>
                    <td><code>{log.action}</code></td>
                    <td>{log.entityType}</td>
                    <td>{log.actor?.email ?? 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
