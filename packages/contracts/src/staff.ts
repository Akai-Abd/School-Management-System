import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const createNamedCatalogSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(5).max(24).optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  joiningDate: isoDateSchema,
  isTeacher: z.boolean().default(false),
  qualifications: z.string().trim().max(240).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).default(0),
  specialization: z.string().trim().max(120).optional(),
  userId: z.string().uuid().optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffStatusSchema = z.object({
  status: z.enum(['active', 'on_leave', 'suspended', 'resigned']),
  effectiveDate: isoDateSchema,
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  notes: z.string().trim().max(400).optional(),
});
export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;

export const assignClassTeacherSchema = z.object({
  academicYearId: z.string().uuid(),
  sectionId: z.string().uuid(),
  staffId: z.string().uuid(),
  isPrimary: z.boolean().default(true),
});
export type AssignClassTeacherInput = z.infer<typeof assignClassTeacherSchema>;

export const assignSubjectTeacherSchema = z.object({
  academicYearId: z.string().uuid(),
  sectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  staffId: z.string().uuid(),
});
export type AssignSubjectTeacherInput = z.infer<typeof assignSubjectTeacherSchema>;
