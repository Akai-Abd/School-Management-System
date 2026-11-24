import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const guardianInputSchema = z.object({
  guardianId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(24),
  email: z.string().trim().email().toLowerCase().optional(),
  occupation: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
  relationship: z.string().trim().min(2).max(40),
  isPrimary: z.boolean().default(true),
  isEmergencyContact: z.boolean().default(true),
});

export const medicalRecordInputSchema = z.object({
  bloodGroup: z.string().trim().max(12).optional(),
  allergies: z.string().trim().max(500).optional(),
  conditions: z.string().trim().max(500).optional(),
  medications: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const admitStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: isoDateSchema,
  gender: z.enum(['male', 'female', 'other']),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  rollNumber: z.string().trim().max(24).optional(),
  guardians: z.array(guardianInputSchema).min(1),
  medicalRecord: medicalRecordInputSchema.optional(),
  electiveSubjectIds: z.array(z.string().uuid()).default([]),
});
export type AdmitStudentInput = z.infer<typeof admitStudentSchema>;

export const updateStudentStatusSchema = z.object({
  status: z.enum(['active', 'transferred', 'graduated', 'archived']),
});
export type UpdateStudentStatusInput = z.infer<typeof updateStudentStatusSchema>;
