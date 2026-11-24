import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');
const hhmmSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM time');

export const createBookSchema = z.object({
  title: z.string().trim().min(1).max(160),
  author: z.string().trim().min(1).max(120),
  publisher: z.string().trim().max(120).optional(),
  isbn: z.string().trim().max(32).optional(),
  accessionNumbers: z.array(z.string().trim().min(1).max(40)).min(1),
});

export const issueBookSchema = z.object({
  copyId: z.string().uuid(),
  borrowerType: z.enum(['student', 'staff']),
  studentId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  dueDate: isoDateSchema,
});

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(3).max(32),
  capacity: z.coerce.number().int().positive().max(120),
  driverStaffId: z.string().uuid().optional(),
  insuranceExpiry: isoDateSchema.optional(),
  fitnessExpiry: isoDateSchema.optional(),
});

export const createRouteSchema = z.object({
  name: z.string().trim().min(2).max(100),
  vehicleId: z.string().uuid().optional(),
  stops: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        stopOrder: z.coerce.number().int().positive(),
        pickupTime: hhmmSchema,
        dropTime: hhmmSchema,
      }),
    )
    .default([]),
});

export const assignTransportSchema = z.object({
  studentId: z.string().uuid(),
  routeId: z.string().uuid(),
  stopId: z.string().uuid(),
});

export const createHostelSchema = z.object({
  name: z.string().trim().min(2).max(100),
  wardenStaffId: z.string().uuid().optional(),
});

export const createHostelRoomSchema = z.object({
  hostelId: z.string().uuid(),
  roomNumber: z.string().trim().min(1).max(24),
  capacity: z.coerce.number().int().positive().max(20),
  bedCodes: z.array(z.string().trim().min(1).max(20)).min(1),
});

export const allocateHostelBedSchema = z.object({
  studentId: z.string().uuid(),
  bedId: z.string().uuid(),
});

export const dispatchNotificationSchema = z.object({
  recipientUserIds: z.array(z.string().uuid()).min(1),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(2000),
  channel: z.enum(['in_app', 'email', 'sms', 'push']).default('in_app'),
});

export const sendMessageSchema = z.object({
  recipientUserId: z.string().uuid(),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
});
