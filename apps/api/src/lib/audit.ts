import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface AuditInput {
  schoolId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  requestId?: string | null;
}

export async function recordAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      requestId: input.requestId ?? null,
    },
  });
}
