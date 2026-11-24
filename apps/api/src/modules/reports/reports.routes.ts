import ExcelJS from 'exceljs';
import { Router } from 'express';
import { recordAuditLog } from '../../lib/audit.js';
import { requireAuth, requirePermission, requireSchoolContext } from '../../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireSchoolContext);

reportsRouter.get('/students.xlsx', requirePermission('students.view'), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const students = await req.tenantPrisma!.student.findMany({
      where: { deletedAt: null },
      include: {
        enrollments: {
          where: { status: 'active' },
          include: { schoolClass: true, section: true },
        },
        guardians: { include: { guardian: true } },
      },
      orderBy: { admissionNumber: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    sheet.columns = [
      { header: 'Admission #', key: 'admissionNumber', width: 16 },
      { header: 'First Name', key: 'firstName', width: 18 },
      { header: 'Last Name', key: 'lastName', width: 18 },
      { header: 'Class', key: 'className', width: 16 },
      { header: 'Section', key: 'sectionName', width: 12 },
      { header: 'Primary Guardian', key: 'guardian', width: 24 },
      { header: 'Guardian Phone', key: 'phone', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    for (const s of students) {
      const enr = s.enrollments[0];
      const g = s.guardians[0]?.guardian;
      sheet.addRow({
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        className: enr?.schoolClass.name ?? '',
        sectionName: enr?.section.name ?? '',
        guardian: g?.fullName ?? '',
        phone: g?.phone ?? '',
        status: s.status,
      });
    }

    await recordAuditLog({
      schoolId,
      actorUserId: req.auth!.userId,
      action: 'report.students_exported',
      entityType: 'student',
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export const meRouter = Router();
meRouter.use(requireAuth, requireSchoolContext);

meRouter.get('/portal', async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const isStudentOnly = req.auth!.roles.includes('student') && !req.auth!.roles.includes('parent') && !req.auth!.roles.includes('school_admin');

    const [settings, guardianLinks, ownStudents] = await Promise.all([
      req.tenantPrisma!.schoolSetting.findFirst({}),
      req.tenantPrisma!.guardian.findMany({
        where: { userId, deletedAt: null },
        include: { students: { select: { studentId: true } } },
      }),
      req.tenantPrisma!.student.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
    ]);

    const studentIds = [
      ...new Set([
        ...guardianLinks.flatMap((g) => g.students.map((st) => st.studentId)),
        ...ownStudents.map((s) => s.id),
      ]),
    ];

    if (studentIds.length === 0) {
      return res.json({ students: [] });
    }

    const canViewFees = !isStudentOnly || Boolean(settings?.studentFeeViewEnabled);

    const [students, attendances, marks, invoices] = await Promise.all([
      req.tenantPrisma!.student.findMany({
        where: { id: { in: studentIds }, deletedAt: null },
        include: {
          enrollments: {
            where: { status: 'active' },
            include: { schoolClass: true, section: true },
          },
        },
      }),
      req.tenantPrisma!.studentAttendance.findMany({ where: { studentId: { in: studentIds } } }),
      req.tenantPrisma!.mark.findMany({
        where: { studentId: { in: studentIds }, examSubject: { exam: { isPublished: true } } },
        include: { examSubject: { include: { exam: true } } },
      }),
      canViewFees
        ? req.tenantPrisma!.invoice.findMany({ where: { studentId: { in: studentIds } } })
        : Promise.resolve([]),
    ]);

    return res.json({
      students: students.map((st) => {
        const stAtt = attendances.filter((a) => a.studentId === st.id);
        const present = stAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
        const stMarks = marks.filter((m) => m.studentId === st.id);
        const stInvoices = invoices.filter((i) => i.studentId === st.id);

        return {
          id: st.id,
          admissionNumber: st.admissionNumber,
          name: `${st.firstName} ${st.lastName}`,
          enrollment: st.enrollments[0]
            ? `${st.enrollments[0].schoolClass.name} - ${st.enrollments[0].section.name}`
            : '—',
          attendanceSummary: { total: stAtt.length, present },
          publishedResultsCount: stMarks.length,
          invoices: stInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            totalAmount: inv.totalAmount,
            paidAmount: inv.paidAmount,
            status: inv.status,
          })),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});
