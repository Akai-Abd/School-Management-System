import { z } from 'zod';

export const createRoleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Role key must use lowercase letters, digits, or underscores'),
  name: z.string().trim().min(2).max(80),
  permissionCodes: z.array(z.string().trim().min(3)).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  permissionCodes: z.array(z.string().trim().min(3)).optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  roleId: z.string().uuid(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['active', 'suspended']).optional(),
});
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
