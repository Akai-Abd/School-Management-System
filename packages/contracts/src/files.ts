import { z } from 'zod';

export const fileVisibilitySchema = z.enum(['private', 'public']);

export const fileRecordSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  visibility: fileVisibilitySchema,
  entityType: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type FileRecordDto = z.infer<typeof fileRecordSchema>;
