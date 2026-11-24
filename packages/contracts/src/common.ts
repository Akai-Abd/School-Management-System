import { z } from 'zod';

export const appModeSchema = z.enum(['saas', 'standalone']);
export type AppMode = z.infer<typeof appModeSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  sortBy: z.string().trim().max(60).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'update',
  'archive',
  'approve',
  'reject',
  'export',
  'publish',
  'manage',
] as const;

export const SYSTEM_ROLE_KEYS = [
  'super_admin',
  'school_admin',
  'teacher',
  'parent',
  'student',
  'accountant',
  'librarian',
  'driver',
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];
