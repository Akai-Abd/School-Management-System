import { Router } from 'express';
import { importCsvRequestSchema } from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { nextDocumentNumber, prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export interface ImportRowError {
  row: number;
  message: string;
}

// shortcut: pure CSV parser for Phase 1 onboarding; swap/extend with exceljs for .xlsx in Phase 2/3
export function parseCsvText(csvText: string): Array<Record<string, string>> {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const splitRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitRow(lines[0]!).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}

export function validateImportRows(
  entityType: 'students' | 'staff' | 'guardians',
  rows: Array<Record<string, string>>,
  existingEmails: Set<string>,
): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    if (entityType === 'students') {
      if (!row.first_name || !row.last_name) {
        errors.push({ row: rowNum, message: 'first_name and last_name are required' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth ?? '')) {
        errors.push({ row: rowNum, message: 'date_of_birth must be YYYY-MM-DD' });
      }
      if (!['male', 'female', 'other'].includes((row.gender ?? '').toLowerCase())) {
        errors.push({ row: rowNum, message: 'gender must be male, female, or other' });
      }
      if (!row.guardian_name || !row.guardian_phone) {
        errors.push({ row: rowNum, message: 'guardian_name and guardian_phone are required' });
      }
    } else if (entityType === 'staff') {
      if (!row.full_name) errors.push({ row: rowNum, message: 'full_name is required' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.joining_date ?? '')) {
        errors.push({ row: rowNum, message: 'joining_date must be YYYY-MM-DD' });
      }
      const email = (row.email ?? '').toLowerCase();
      if (email) {
        if (existingEmails.has(email) || seenEmails.has(email)) {
          errors.push({ row: rowNum, message: `Duplicate staff email: ${email}` });
        }
        seenEmails.add(email);
      }
    } else {
      if (!row.full_name || !row.phone) {
        errors.push({ row: rowNum, message: 'full_name and phone are required' });
      }
    }
  });

  return errors;
}

export const importsRouter = Router();
importsRouter.use(requireAuth, requireSchoolContext, requireModule('imports'));

importsRouter.post('/preview', requireCsrf, requirePermission('imports.create'), validateBody(importCsvRequestSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const rows = parseCsvText(req.body.csvText);
    if (rows.length === 0) throw Errors.badRequest('CSV must contain a header row and at least one data row');

    const existingStaff = req.body.entityType === 'staff'
      ? await req.tenantPrisma!.staff.findMany({ where: { deletedAt: null, email: { not: null } }, select: { email: true } })
      : [];
    const existingEmails = new Set(existingStaff.map((s) => (s.email ?? '').toLowerCase()));

    const errors = validateImportRows(req.body.entityType, rows, existingEmails);
    const errorRows = new Set(errors.map((e) => e.row)).size;

    const batch = await req.tenantPrisma!.importBatch.create({
      data: {
        schoolId,
        entityType: req.body.entityType,
        status: 'validated',
        totalRows: rows.length,
        validRows: rows.length - errorRows,
        errorRows,
        errorsJson: errors as unknown as object,
        createdByUserId: req.auth!.userId,
      },
    });

    res.json({ batchId: batch.id, totalRows: rows.length, validRows: rows.length - errorRows, errorRows, errors });
  } catch (err) {
    next(err);
  }
});

importsRouter.post('/commit', requireCsrf, requirePermission('imports.create'), validateBody(importCsvRequestSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { entityType, csvText, academicYearId, classId, sectionId } = req.body;
    const rows = parseCsvText(csvText);
    if (rows.length === 0) throw Errors.badRequest('CSV must contain a header row and at least one data row');

    const existingStaff = entityType === 'staff'
      ? await req.tenantPrisma!.staff.findMany({ where: { deletedAt: null, email: { not: null } }, select: { email: true } })
      : [];
    const errors = validateImportRows(entityType, rows, new Set(existingStaff.map((s) => (s.email ?? '').toLowerCase())));
    if (errors.length > 0) {
      throw Errors.badRequest('Import validation failed; zero records written', errors);
    }

    if (entityType === 'students') {
      if (!academicYearId || !classId || !sectionId) {
        throw Errors.badRequest('academicYearId, classId, and sectionId are required for student imports');
      }
      const section = await req.tenantPrisma!.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!section) throw Errors.badRequest('Section does not belong to selected class in active school');
    }

    const batch = await prisma.$transaction(async (tx) => {
      if (entityType === 'students') {
        for (const row of rows) {
          const admissionNumber = await nextDocumentNumber(tx, schoolId, 'admission');
          const student = await tx.student.create({
            data: {
              schoolId,
              admissionNumber,
              firstName: row.first_name!,
              lastName: row.last_name!,
              dateOfBirth: new Date(row.date_of_birth!),
              gender: row.gender!.toLowerCase(),
            },
          });
          const guardian = await tx.guardian.create({
            data: {
              schoolId,
              fullName: row.guardian_name!,
              phone: row.guardian_phone!,
              email: row.guardian_email || undefined,
            },
          });
          await tx.studentGuardian.create({
            data: {
              schoolId,
              studentId: student.id,
              guardianId: guardian.id,
              relationship: row.relationship || 'Parent',
              isPrimary: true,
              isEmergencyContact: true,
            },
          });
          await tx.studentEnrollment.create({
            data: {
              schoolId,
              studentId: student.id,
              academicYearId: academicYearId!,
              classId: classId!,
              sectionId: sectionId!,
            },
          });
        }
      } else if (entityType === 'staff') {
        for (const row of rows) {
          const employeeCode = await nextDocumentNumber(tx, schoolId, 'employee');
          const joiningDate = new Date(row.joining_date!);
          const staff = await tx.staff.create({
            data: {
              schoolId,
              employeeCode,
              fullName: row.full_name!,
              email: row.email || undefined,
              phone: row.phone || undefined,
              joiningDate,
              isTeacher: (row.is_teacher ?? '').toLowerCase() === 'true',
            },
          });
          await tx.staffEmploymentHistory.create({
            data: { schoolId, staffId: staff.id, eventType: 'joined', effectiveDate: joiningDate },
          });
        }
      } else {
        for (const row of rows) {
          await tx.guardian.create({
            data: { schoolId, fullName: row.full_name!, phone: row.phone!, email: row.email || undefined },
          });
        }
      }

      return tx.importBatch.create({
        data: {
          schoolId,
          entityType,
          status: 'committed',
          totalRows: rows.length,
          validRows: rows.length,
          errorRows: 0,
          createdByUserId: req.auth!.userId,
          committedAt: new Date(),
        },
      });
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'import.committed',
      entityType: 'import_batch',
      entityId: batch.id,
      metadata: { entityType, totalRows: rows.length },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
});
