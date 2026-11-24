import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');
const hhmmSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM time');

export const bulkStudentAttendanceSchema = z.object({
  academicYearId: z.string().uuid(),
  sectionId: z.string().uuid(),
  attendanceDate: isoDateSchema,
  periodNumber: z.coerce.number().int().min(0).max(16).default(0),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(['present', 'absent', 'late', 'half_day', 'excused']),
        remarks: z.string().trim().max(240).optional(),
      }),
    )
    .min(1),
});

export const correctAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'half_day', 'excused']),
  reason: z.string().trim().min(3).max(240),
});

export const createLeaveRequestSchema = z.object({
  applicantType: z.enum(['student', 'staff']),
  studentId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  reason: z.string().trim().min(3).max(500),
});

export const reviewLeaveSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().trim().max(240).optional(),
});

export const createPeriodSchema = z.object({
  name: z.string().trim().min(1).max(60),
  periodNumber: z.coerce.number().int().min(1).max(20),
  startTime: hhmmSchema,
  endTime: hhmmSchema,
  isBreak: z.boolean().default(false),
});

export const createClassroomSchema = z.object({
  name: z.string().trim().min(1).max(60),
  capacity: z.coerce.number().int().positive().max(500).optional(),
});

export const createTimetableEntrySchema = z.object({
  academicYearId: z.string().uuid(),
  sectionId: z.string().uuid(),
  periodId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  subjectId: z.string().uuid(),
  staffId: z.string().uuid(),
  classroomId: z.string().uuid().optional(),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.optional(),
});

export const createExamSchema = z.object({
  academicYearId: z.string().uuid(),
  academicTermId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
});

export const addExamSubjectSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  examDate: isoDateSchema.optional(),
  maxMarks: z.coerce.number().positive().max(1000),
  passingMarks: z.coerce.number().nonnegative().max(1000),
  weightagePct: z.coerce.number().positive().max(100).default(100),
});

export const enterMarksSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(['present', 'absent', 'exempt', 'withheld']),
        marksObtained: z.coerce.number().nonnegative().nullable().optional(),
        remarks: z.string().trim().max(200).optional(),
      }),
    )
    .min(1),
  revisionReason: z.string().trim().min(3).max(240).optional(),
});

export const createHomeworkSchema = z.object({
  academicYearId: z.string().uuid(),
  sectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  dueDate: isoDateSchema,
  maxMarks: z.coerce.number().positive().max(1000).optional(),
});

export const submitHomeworkSchema = z.object({
  studentId: z.string().uuid(),
  content: z.string().trim().min(1).max(5000),
});

export const evaluateHomeworkSchema = z.object({
  marksAwarded: z.coerce.number().nonnegative().max(1000).optional(),
  feedback: z.string().trim().max(1000).optional(),
});

export const promoteStudentSchema = z.object({
  studentId: z.string().uuid(),
  actionType: z.enum(['promoted', 'internal_transfer', 'withdrawn']),
  toAcademicYearId: z.string().uuid().optional(),
  toClassId: z.string().uuid().optional(),
  toSectionId: z.string().uuid().optional(),
  notes: z.string().trim().max(400).optional(),
});
