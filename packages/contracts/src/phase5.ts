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
  tagline: z.string().trim().max(200).optional(),
  principalMessage: z.string().trim().max(4000).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  seoDescription: z.string().trim().max(300).optional(),
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
