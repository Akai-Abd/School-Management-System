import { Prisma, PrismaClient } from '@prisma/client';
import { Errors } from './errors.js';

export const prisma = new PrismaClient();

const TENANT_SCOPED_MODELS = new Set([
  'SchoolSetting',
  'SchoolModule',
  'SchoolMembership',
  'Role',
  'RolePermission',
  'UserRole',
  'UserInvitation',
  'DocumentSequence',
  'IdempotencyKey',
  'Attachment',
  'AcademicYear',
  'AcademicTerm',
  'CalendarEvent',
  'SchoolClass',
  'Section',
  'Subject',
  'SubjectGroup',
  'ClassSubject',
  'Department',
  'Designation',
  'Staff',
  'StaffEmploymentHistory',
  'TeacherProfile',
  'ClassTeacher',
  'TeacherAssignment',
  'Student',
  'Guardian',
  'StudentGuardian',
  'StudentEnrollment',
  'StudentSubject',
  'StudentMedicalRecord',
  'StudentEmergencyContact',
  'ImportBatch',
  'AttendanceSession',
  'StudentAttendance',
  'StaffAttendance',
  'LeaveRequest',
  'TimetablePeriod',
  'Classroom',
  'TimetableEntry',
  'Exam',
  'ExamSubject',
  'Mark',
  'MarkRevision',
  'Homework',
  'HomeworkSubmission',
  'StudentPromotion',
  'Notification',
  'FeeType',
  'FeeStructure',
  'FeeStructureItem',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'PaymentAllocation',
  'StudentCredit',
  'PaymentRefund',
  'FinancialEvent',
  'Account',
  'FiscalYear',
  'AccountingPeriod',
  'PostingRule',
  'JournalEntry',
  'JournalEntryLine',
  'BookCategory',
  'Book',
  'BookCopy',
  'BookIssue',
  'Vehicle',
  'TransportRoute',
  'RouteStop',
  'TransportAssignment',
  'TransportAttendance',
  'Hostel',
  'HostelRoom',
  'HostelBed',
  'HostelAllocation',
  'NotificationDelivery',
  'Message',
  'QuestionBank',
  'Question',
  'QuestionOption',
  'OnlineExam',
  'OnlineExamQuestion',
  'ExamAttempt',
  'ExamAnswer',
  'WebsiteSetting',
  'WebsitePage',
  'WebsiteAnnouncement',
  'WebsiteEvent',
  'AdmissionApplication',
  'ContactInquiry',
]);

/**
 * Returns a Prisma client scoped to a single schoolId for all tenant-owned models.
 * Phase 6 adds PostgreSQL RLS (`SET LOCAL app.current_school_id`) on top of this boundary.
 */
export function forTenant(schoolId: string) {
  if (!schoolId) {
    throw Errors.forbidden('Active school context is required');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const scopedArgs = (args ?? {}) as Record<string, unknown>;

          if (
            operation === 'findMany' ||
            operation === 'findFirst' ||
            operation === 'findFirstOrThrow' ||
            operation === 'count' ||
            operation === 'aggregate' ||
            operation === 'groupBy' ||
            operation === 'updateMany' ||
            operation === 'deleteMany'
          ) {
            scopedArgs.where = { ...((scopedArgs.where as object) ?? {}), schoolId };
          } else if (operation === 'create') {
            scopedArgs.data = { ...((scopedArgs.data as object) ?? {}), schoolId };
          } else if (operation === 'createMany') {
            const data = scopedArgs.data;
            scopedArgs.data = Array.isArray(data)
              ? data.map((row) => ({ ...(row as object), schoolId }))
              : { ...(data as object), schoolId };
          } else if (
            operation === 'findUnique' ||
            operation === 'findUniqueOrThrow' ||
            operation === 'update' ||
            operation === 'delete'
          ) {
            // Force compound or post-check protection for single-record queries
            const result = await query(scopedArgs);
            if (result && typeof result === 'object' && 'schoolId' in result && result.schoolId !== schoolId) {
              throw Errors.notFound();
            }
            return result;
          }

          return query(scopedArgs);
        },
      },
    },
  });
}

/** Atomically generates the next school-scoped formatted document number inside a transaction. */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
  docType: string,
  scopeKey = 'default',
  padWidth = 6,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ prefix: string; next_number: number }>>`
    UPDATE document_sequences
    SET next_number = next_number + 1
    WHERE school_id = ${schoolId}::uuid
      AND doc_type = ${docType}
      AND scope_key = ${scopeKey}
    RETURNING prefix, next_number - 1 AS next_number
  `;

  const row = rows[0];
  if (!row) {
    throw Errors.badRequest(`Missing document sequence for ${docType} (${scopeKey})`);
  }
  return `${row.prefix}${String(row.next_number).padStart(padWidth, '0')}`;
}

/** Runs a transaction with PostgreSQL RLS tenant context (`SET LOCAL app.current_school_id`). */
export async function withTenantTx<T>(
  schoolId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!schoolId) throw Errors.forbidden('Active school context is required');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}
