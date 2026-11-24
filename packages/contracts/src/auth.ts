import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  schoolId: z.string().uuid().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const switchSchoolSchema = z.object({
  schoolId: z.string().uuid().nullable(),
});
export type SwitchSchoolInput = z.infer<typeof switchSchoolSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().min(10).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const schoolMembershipSummarySchema = z.object({
  schoolId: z.string().uuid(),
  schoolName: z.string(),
  schoolSlug: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type SchoolMembershipSummary = z.infer<typeof schoolMembershipSummarySchema>;

export const authMeResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    isPlatformAdmin: z.boolean(),
  }),
  activeSchoolId: z.string().uuid().nullable(),
  memberships: z.array(schoolMembershipSummarySchema),
  csrfToken: z.string(),
  appMode: z.enum(['saas', 'standalone']),
});
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
