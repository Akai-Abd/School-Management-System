import { z } from 'zod';

export const importCsvRequestSchema = z.object({
  entityType: z.enum(['students', 'staff', 'guardians']),
  csvText: z.string().min(1).max(2_000_000),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
});
export type ImportCsvRequest = z.infer<typeof importCsvRequestSchema>;
