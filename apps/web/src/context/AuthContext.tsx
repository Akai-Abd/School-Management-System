import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthMeResponse, LoginInput, SchoolMembershipSummary } from '@school-erp/contracts';
import { apiFetch, setCsrfToken } from '../api/client';

interface AuthContextValue {
  session: AuthMeResponse | null;
  activeMembership: SchoolMembershipSummary | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<AuthMeResponse>;
  logout: () => Promise<void>;
  switchSchool: (schoolId: string | null) => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: session = null, isLoading } = useQuery<AuthMeResponse | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const me = await apiFetch<AuthMeResponse>('/api/v1/auth/me');
        setCsrfToken(me.csrfToken);
        return me;
      } catch {
        setCsrfToken(null);
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const activeMembership =
    session?.memberships.find((m) => m.schoolId === session.activeSchoolId) ?? null;

  async function login(input: LoginInput) {
    const me = await apiFetch<AuthMeResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setCsrfToken(me.csrfToken);
    queryClient.setQueryData(['auth', 'me'], me);
    return me;
  }

  async function logout() {
    await apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
    setCsrfToken(null);
    queryClient.setQueryData(['auth', 'me'], null);
    queryClient.clear();
  }

  async function switchSchool(schoolId: string | null) {
    const me = await apiFetch<AuthMeResponse>('/api/v1/auth/switch-school', {
      method: 'POST',
      body: JSON.stringify({ schoolId }),
    });
    setCsrfToken(me.csrfToken);
    queryClient.setQueryData(['auth', 'me'], me);
    await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }

  function hasPermission(code: string) {
    if (!activeMembership) return false;
    return activeMembership.roles.includes('school_admin') || activeMembership.permissions.includes(code);
  }

  return (
    <AuthContext.Provider
      value={{ session, activeMembership, isLoading, login, logout, switchSchool, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
