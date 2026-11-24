import { Router } from 'express';
import { promoteStudentSchema } from '@school-erp/contracts';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { nextDocumentNumber, prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export const promotionsRouter = Router();
promotionsRouter.use(requireAuth, requireSchoolContext, requireModule('students'));

promotionsRouter.post('/', requireCsrf, requirePermission('students.update'), validateBody(promoteStudentSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { studentId, actionType, toAcademicYearId, toClassId, toSectionId, notes } = req.body;

    const student = await req.tenantPrisma!.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw Errors.notFound('Student not found');

    const activeEnrollment = await req.tenantPrisma!.studentEnrollment.findFirst({
      where: { studentId: student.id, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
    });
    if (!activeEnrollment) throw Errors.badRequest('Student has no active enrollment');

    if (actionType !== 'withdrawn') {
      if (!toAcademicYearId || !toClassId || !toSectionId) {
        throw Errors.badRequest('Destination academicYearId, classId, and sectionId are required');
      }
      const targetSection = await req.tenantPrisma!.section.findFirst({
        where: { id: toSectionId, classId: toClassId, deletedAt: null },
      });
      if (!targetSection) throw Errors.badRequest('Destination section does not match class');
    }

    const promotion = await prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.update({
        where: { id: activeEnrollment.id },
        data: {
          status: actionType === 'promoted' ? 'promoted' : actionType === 'withdrawn' ? 'withdrawn' : 'transferred',
          closedAt: new Date(),
        },
      });

      let toEnrollmentId: string | null = null;
      let certificateNumber: string | null = null;

      if (actionType === 'withdrawn') {
        await tx.student.update({ where: { id: student.id }, data: { status: 'transferred' } });
        await tx.documentSequence.upsert({
          where: { schoolId_docType_scopeKey: { schoolId, docType: 'tc', scopeKey: 'default' } },
          update: {},
          create: { schoolId, docType: 'tc', scopeKey: 'default', prefix: 'TC-', nextNumber: 1 },
        });
        certificateNumber = await nextDocumentNumber(tx, schoolId, 'tc');
      } else {
        const nextEnr = await tx.studentEnrollment.create({
          data: {
            schoolId,
            studentId: student.id,
            academicYearId: toAcademicYearId!,
            classId: toClassId!,
            sectionId: toSectionId!,
            status: 'active',
          },
        });
        toEnrollmentId = nextEnr.id;
      }

      return tx.studentPromotion.create({
        data: {
          schoolId,
          studentId: student.id,
          fromEnrollmentId: activeEnrollment.id,
          toEnrollmentId,
          actionType,
          certificateNumber,
          notes,
          createdByUserId: req.auth!.userId,
        },
      });
    });

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: `student.${actionType}`,
      entityType: 'student',
      entityId: student.id,
      metadata: { certificateNumber: promotion.certificateNumber, toEnrollmentId: promotion.toEnrollmentId },
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(201).json(promotion);
  } catch (err) {
    next(err);
  }
});
