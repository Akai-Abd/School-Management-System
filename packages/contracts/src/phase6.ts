import { z } from 'zod';
import { CONFIGURABLE_MODULE_KEYS } from './common.js';

export const createPlanSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
  name: z.string().trim().min(2).max(100),
  maxStudents: z.coerce.number().int().positive().default(1000),
  maxStaff: z.coerce.number().int().positive().default(200),
  enabledModules: z.array(z.enum(CONFIGURABLE_MODULE_KEYS)).min(1),
  priceMonthlyInr: z.coerce.number().nonnegative().default(0),
});

export const onboardSchoolSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
  adminEmail: z.string().trim().email().toLowerCase(),
  adminName: z.string().trim().min(2).max(120),
  adminPassword: z.string().min(10).max(128),
  planId: z.string().uuid().optional(),
});

export const updateSchoolStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

export const createSupportGrantSchema = z.object({
  reason: z.string().trim().min(5).max(300),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
});

export const verifyLicenseSchema = z.object({
  payload: z.string().min(10),
  signature: z.string().min(16),
});
