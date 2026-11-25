import { z } from 'zod';

export const createQuestionBankSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});

export const createQuestionSchema = z.object({
  questionType: z.enum(['mcq', 'msq', 'true_false', 'descriptive']),
  prompt: z.string().trim().min(2).max(2000),
  marks: z.coerce.number().positive().max(100),
  correctAnswer: z.string().trim().max(1000).optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(300),
        isCorrect: z.boolean().default(false),
      }),
    )
    .default([]),
});

export const createOnlineExamSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  durationMinutes: z.coerce.number().int().min(1).max(360),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  randomizeQuestions: z.boolean().default(false),
  questionIds: z.array(z.string().uuid()).min(1),
});

export const saveExamAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().max(5000).optional(),
  selectedOptionIds: z.array(z.string().uuid()).default([]),
});

export const evaluateAnswerSchema = z.object({
  marksAwarded: z.coerce.number().nonnegative().max(100),
});

export const upsertWebsiteSettingSchema = z.object({
  tagline: z.string().trim().max(200).nullable().optional(),
  principalMessage: z.string().trim().max(4000).nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  seoDescription: z.string().trim().max(300).nullable().optional(),
});

export const upsertWebsitePageSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(160),
  contentHtml: z.string().min(1).max(50_000),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  status: z.enum(['draft', 'scheduled', 'published']).default('draft'),
});

export const createWebsiteAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(2000),
  isPublished: z.boolean().default(true),
});

export const createWebsiteEventSchema = z.object({
  title: z.string().trim().min(2).max(160),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date'),
  description: z.string().trim().max(1000).optional(),
  isPublished: z.boolean().default(true),
});

export const createAdmissionApplicationSchema = z.object({
  studentName: z.string().trim().min(2).max(150),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date of birth'),
  gender: z.enum(['', 'male', 'female', 'other']).optional(),
  classId: z.string().uuid().optional().or(z.literal('')),
  guardianName: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(5).max(50),
  email: z.string().trim().email().max(150),
  previousSchool: z.string().trim().max(180).optional(),
  address: z.string().trim().max(255).optional(),
  message: z.string().trim().max(2000).optional(),
});

export const updateAdmissionStatusSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'accepted', 'rejected']),
});

export const createContactInquirySchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(150),
  phone: z.string().trim().max(50).optional(),
  subject: z.string().trim().max(180).optional(),
  message: z.string().trim().min(2).max(3000),
});

export const updateInquiryStatusSchema = z.object({
  status: z.enum(['new', 'resolved']),
});
