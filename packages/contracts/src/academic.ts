import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const createAcademicYearSchema = z.object({
  name: z.string().trim().min(2).max(60),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  isCurrent: z.boolean().default(false),
});
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const createAcademicTermSchema = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});
export type CreateAcademicTermInput = z.infer<typeof createAcademicTermSchema>;

export const createCalendarEventSchema = z.object({
  academicYearId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  eventType: z.enum(['holiday', 'event', 'exam_period', 'working_day']),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  description: z.string().trim().max(500).optional(),
});
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;

export const createClassSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().max(24).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const createSectionSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  capacity: z.coerce.number().int().positive().max(500).optional(),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(24),
  isElective: z.boolean().default(false),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const createSubjectGroupSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  minSelect: z.coerce.number().int().min(0).default(1),
  maxSelect: z.coerce.number().int().min(1).default(1),
});
export type CreateSubjectGroupInput = z.infer<typeof createSubjectGroupSchema>;

export const assignClassSubjectSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  subjectGroupId: z.string().uuid().optional(),
  isMandatory: z.boolean().default(true),
});
export type AssignClassSubjectInput = z.infer<typeof assignClassSubjectSchema>;
