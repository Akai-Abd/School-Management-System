import type { forTenant } from '../lib/prisma.js';

export interface AuthContext {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  activeSchoolId: string | null;
  csrfToken: string;
  permissions: Set<string>;
  roles: string[];
  enabledModules: Set<string>;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthContext;
      tenantPrisma?: ReturnType<typeof forTenant>;
    }
  }
}
