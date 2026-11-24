import { Router } from 'express';
import {
  admitStudentSchema,
  paginationQuerySchema,
  updateStudentStatusSchema,
} from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { nextDocumentNumber, prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';

export function findDisallowedSubjects(allowedSubjectIds: string[], requestedSubjectIds: string[]): string[] {
  const allowed = new Set(allowedSubjectIds);
  return requestedSubjectIds.filter((id) => !allowed.has(id));
}

export const studentsRouter = Router();
studentsRouter.use(requireAuth, requireSchoolContext, requireModule('students'));

studentsRouter.get('/', requirePermission('students.view'), validateQuery(paginationQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, search } = paginationQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { admissionNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      req.tenantPrisma!.student.findMany({
        where,
        include: {
          enrollments: {
            where: { status: 'active' },
            include: {
              schoolClass: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
              academicYear: { select: { id: true, name: true } },
            },
          },
          guardians: {
            include: { guardian: { select: { id: true, fullName: true, phone: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      req.tenantPrisma!.student.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
});

studentsRouter.get('/guardians', requirePermission('students.view'), async (req, res, next) => {
  try {
    const items = await req.tenantPrisma!.guardian.findMany({
      where: { deletedAt: null },
      orderBy: { fullName: 'asc' },
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

studentsRouter.get('/:id', requirePermission('students.view'), async (req, res, next) => {
  try {
    const student = await req.tenantPrisma!.student.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        guardians: { include: { guardian: true } },
        enrollments: {
          include: {
            academicYear: true,
            schoolClass: true,
            section: true,
            studentSubjects: { include: { subject: true } },
          },
          orderBy: { enrolledAt: 'desc' },
        },
        emergencyContacts: true,
      },
    });
    if (!student) throw Errors.notFound('Student not found');
    res.json(student);
  } catch (err) {
    next(err);
  }
});

/** Medical data is gated and every read is recorded in audit_logs (M02-AC6). */
studentsRouter.get('/:id/medical', requirePermission('students.view'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const studentId = req.params.id;
    if (!studentId) throw Errors.badRequest('Student ID is required');

    const student = await req.tenantPrisma!.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { medicalRecord: true },
    });
    if (!student) throw Errors.notFound('Student not found');

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'student.medical_viewed',
      entityType: 'student',
      entityId: student.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ medicalRecord: student.medicalRecord });
  } catch (err) {
    next(err);
  }
});

studentsRouter.post('/', requireCsrf, requirePermission('students.create'), validateBody(admitStudentSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const input = req.body;

    const [year, section, classSubjects] = await Promise.all([
      req.tenantPrisma!.academicYear.findFirst({ where: { id: input.academicYearId, deletedAt: null } }),
      req.tenantPrisma!.section.findFirst({ where: { id: input.sectionId, classId: input.classId, deletedAt: null } }),
      req.tenantPrisma!.classSubject.findMany({
        where: { academicYearId: input.academicYearId, classId: input.classId },
      }),
    ]);

    if (!year) throw Errors.badRequest('Academic year not found');
    if (!section) throw Errors.badRequest('Section does not belong to the selected class');

    const disallowed = findDisallowedSubjects(
      classSubjects.map((cs) => cs.subjectId),
      input.electiveSubjectIds,
    );
    if (disallowed.length > 0) {
      throw Errors.badRequest(`Subjects not offered for this class and academic year: ${disallowed.join(', ')}`);
    }

    const mandatoryIds = classSubjects.filter((cs) => cs.isMandatory).map((cs) => cs.subjectId);
    const subjectIds = [...new Set([...mandatoryIds, ...input.electiveSubjectIds])];

    const created = await prisma.$transaction(async (tx) => {
      const admissionNumber = await nextDocumentNumber(tx, schoolId, 'admission');
      const student = await tx.student.create({
        data: {
          schoolId,
          admissionNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: new Date(input.dateOfBirth),
          gender: input.gender,
        },
      });

      for (const g of input.guardians) {
        let guardianId = g.guardianId;
        if (guardianId) {
          const existingGuardian = await tx.guardian.findFirst({
            where: { id: guardianId, schoolId, deletedAt: null },
          });
          if (!existingGuardian) throw Errors.badRequest(`Guardian ${guardianId} not found in school`);
        } else {
          const newGuardian = await tx.guardian.create({
            data: {
              schoolId,
              fullName: g.fullName,
              phone: g.phone,
              email: g.email,
              occupation: g.occupation,
              address: g.address,
            },
          });
          guardianId = newGuardian.id;
        }

        await tx.studentGuardian.create({
          data: {
            schoolId,
            studentId: student.id,
            guardianId,
            relationship: g.relationship,
            isPrimary: g.isPrimary,
            isEmergencyContact: g.isEmergencyContact,
          },
        });
      }

      const enrollment = await tx.studentEnrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicYearId: input.academicYearId,
          classId: input.classId,
          sectionId: input.sectionId,
          rollNumber: input.rollNumber,
        },
      });

      if (subjectIds.length > 0) {
        await tx.studentSubject.createMany({
          data: subjectIds.map((subjectId) => ({
            schoolId,
            enrollmentId: enrollment.id,
            subjectId,
          })),
        });
      }

      if (input.medicalRecord) {
        await tx.studentMedicalRecord.create({
          data: { schoolId, studentId: student.id, ...input.medicalRecord },
        });
      }

      return student;
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'student.admitted',
      entityType: 'student',
      entityId: created.id,
      metadata: { admissionNumber: created.admissionNumber },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

studentsRouter.patch('/:id/status', requireCsrf, requirePermission('students.update'), validateBody(updateStudentStatusSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const studentId = req.params.id;
    if (!studentId) throw Errors.badRequest('Student ID is required');

    const student = await req.tenantPrisma!.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw Errors.notFound('Student not found');

    await prisma.student.update({ where: { id: student.id }, data: { status: req.body.status } });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'student.status_updated',
      entityType: 'student',
      entityId: student.id,
      metadata: { from: student.status, to: req.body.status },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});
