import { z } from 'zod';
import { CONFIGURABLE_MODULE_KEYS } from './common.js';

const workingDaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export const updateSchoolSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  workingDays: z.array(workingDaySchema).min(1).max(7).optional(),
  roundingPolicy: z.enum(['per_line_half_up', 'per_invoice_half_up']).optional(),
  studentFeeViewEnabled: z.boolean().optional(),
  discountApprovalAmount: z.number().nonnegative().nullable().optional(),
});
export type UpdateSchoolSettingsInput = z.infer<typeof updateSchoolSettingsSchema>;

export const updateSchoolModulesSchema = z.object({
  modules: z
    .array(
      z.object({
        moduleKey: z.enum(CONFIGURABLE_MODULE_KEYS),
        isEnabled: z.boolean(),
      }),
    )
    .min(1),
});
export type UpdateSchoolModulesInput = z.infer<typeof updateSchoolModulesSchema>;

export const updateDocumentSequenceSchema = z.object({
  prefix: z.string().trim().max(24),
  scopeKey: z.string().trim().min(1).max(40).default('default'),
});
export type UpdateDocumentSequenceInput = z.infer<typeof updateDocumentSequenceSchema>;
