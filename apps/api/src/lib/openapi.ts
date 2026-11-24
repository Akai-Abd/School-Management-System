import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  acceptInviteSchema,
  admitStudentSchema,
  apiErrorSchema,
  authMeResponseSchema,
  bulkStudentAttendanceSchema,
  collectPaymentSchema,
  createAccountSchema,
  createAcademicTermSchema,
  createAcademicYearSchema,
  createBookSchema,
  createClassSchema,
  createExamSchema,
  createFeeTypeSchema,
  createHomeworkSchema,
  createHostelSchema,
  createInvoiceSchema,
  createJournalEntrySchema,
  createOnlineExamSchema,
  createQuestionBankSchema,
  createRoleSchema,
  createRouteSchema,
  createSectionSchema,
  createStaffSchema,
  createSubjectSchema,
  createTimetableEntrySchema,
  upsertWebsitePageSchema,
  fileRecordSchema,
  forgotPasswordSchema,
  importCsvRequestSchema,
  inviteUserSchema,
  loginSchema,
  onboardSchoolSchema,
  promoteStudentSchema,
  resetPasswordSchema,
  switchSchoolSchema,
  updateDocumentSequenceSchema,
  updateRoleSchema,
  updateSchoolModulesSchema,
  updateSchoolSettingsSchema,
  updateUserRolesSchema,
} from '@school-erp/contracts';
import { z } from 'zod';

extendZodWithOpenApi(z);

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'school_erp_sid',
  });

  registry.registerPath({
    method: 'get',
    path: '/healthz',
    tags: ['System'],
    summary: 'Liveness check',
    responses: {
      200: {
        description: 'Service is healthy',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ok'), mode: z.enum(['saas', 'standalone']) }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['Auth'],
    summary: 'Authenticate with email and password',
    request: {
      body: { content: { 'application/json': { schema: loginSchema } } },
    },
    responses: {
      200: { description: 'Authenticated', content: { 'application/json': { schema: authMeResponseSchema } } },
      401: { description: 'Invalid credentials', content: { 'application/json': { schema: apiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    tags: ['Auth'],
    summary: 'Get active session user and memberships',
    security: [{ sessionCookie: [] }],
    responses: {
      200: { description: 'Session state', content: { 'application/json': { schema: authMeResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/switch-school',
    tags: ['Auth'],
    summary: 'Switch active school context for current session',
    security: [{ sessionCookie: [] }],
    request: {
      body: { content: { 'application/json': { schema: switchSchoolSchema } } },
    },
    responses: {
      200: { description: 'Updated session state', content: { 'application/json': { schema: authMeResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/forgot-password',
    tags: ['Auth'],
    summary: 'Request password reset token',
    request: {
      body: { content: { 'application/json': { schema: forgotPasswordSchema } } },
    },
    responses: { 200: { description: 'Accepted' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/reset-password',
    tags: ['Auth'],
    summary: 'Reset password using token',
    request: {
      body: { content: { 'application/json': { schema: resetPasswordSchema } } },
    },
    responses: { 200: { description: 'Password updated' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/accept-invite',
    tags: ['Auth'],
    summary: 'Accept user invitation and set account password',
    request: { body: { content: { 'application/json': { schema: acceptInviteSchema } } } },
    responses: { 200: { description: 'Invitation accepted' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/settings',
    tags: ['Settings'],
    summary: 'Get school profile, settings, enabled modules, and numbering sequences',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'School settings bundle' } },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/settings',
    tags: ['Settings'],
    summary: 'Update school profile and settings',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: updateSchoolSettingsSchema } } } },
    responses: { 200: { description: 'Updated' } },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/v1/settings/modules',
    tags: ['Settings'],
    summary: 'Enable or disable school modules',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: updateSchoolModulesSchema } } } },
    responses: { 200: { description: 'Updated modules' } },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/settings/sequences/{docType}',
    tags: ['Settings'],
    summary: 'Update document sequence prefix for future documents',
    security: [{ sessionCookie: [] }],
    request: {
      params: z.object({ docType: z.string() }),
      body: { content: { 'application/json': { schema: updateDocumentSequenceSchema } } },
    },
    responses: { 200: { description: 'Updated sequence' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/roles',
    tags: ['RBAC'],
    summary: 'List roles in active school',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Roles list' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/roles',
    tags: ['RBAC'],
    summary: 'Create custom role in active school',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createRoleSchema } } } },
    responses: { 201: { description: 'Role created' } },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/roles/{id}',
    tags: ['RBAC'],
    summary: 'Update role name or permissions',
    security: [{ sessionCookie: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: updateRoleSchema } } },
    },
    responses: { 200: { description: 'Role updated' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/invite',
    tags: ['Users'],
    summary: 'Invite user into active school',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: inviteUserSchema } } } },
    responses: { 201: { description: 'Invitation created' } },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/users/{membershipId}/roles',
    tags: ['Users'],
    summary: 'Assign roles or update membership status',
    security: [{ sessionCookie: [] }],
    request: {
      params: z.object({ membershipId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: updateUserRolesSchema } } },
    },
    responses: { 200: { description: 'Updated' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/audit-logs',
    tags: ['Audit'],
    summary: 'List school audit logs',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Paginated audit logs' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/academic/years',
    tags: ['Academic'],
    summary: 'List academic years and terms',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Academic years' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/academic/years',
    tags: ['Academic'],
    summary: 'Create academic year',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createAcademicYearSchema } } } },
    responses: { 201: { description: 'Academic year created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/academic/terms',
    tags: ['Academic'],
    summary: 'Create non-overlapping academic term',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createAcademicTermSchema } } } },
    responses: { 201: { description: 'Term created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/academic/classes',
    tags: ['Academic'],
    summary: 'Create class',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createClassSchema } } } },
    responses: { 201: { description: 'Class created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/academic/sections',
    tags: ['Academic'],
    summary: 'Create section under class',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createSectionSchema } } } },
    responses: { 201: { description: 'Section created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/academic/subjects',
    tags: ['Academic'],
    summary: 'Create subject',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createSubjectSchema } } } },
    responses: { 201: { description: 'Subject created' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/staff',
    tags: ['Staff'],
    summary: 'List staff members',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Paginated staff' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/staff',
    tags: ['Staff'],
    summary: 'Register staff member and optional teacher profile',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createStaffSchema } } } },
    responses: { 201: { description: 'Staff created' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/students',
    tags: ['Students'],
    summary: 'List students and active enrollments',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Paginated students' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/students',
    tags: ['Students'],
    summary: 'Admit student with guardians and enrollment',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: admitStudentSchema } } } },
    responses: { 201: { description: 'Student admitted' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/imports/preview',
    tags: ['Imports'],
    summary: 'Dry-run validate CSV onboarding file',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: importCsvRequestSchema } } } },
    responses: { 200: { description: 'Validation summary' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/imports/commit',
    tags: ['Imports'],
    summary: 'Commit validated CSV onboarding file',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: importCsvRequestSchema } } } },
    responses: { 201: { description: 'Import committed' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/attendance/student-bulk',
    tags: ['Attendance'],
    summary: 'Record or update bulk student attendance for a section/date',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: bulkStudentAttendanceSchema } } } },
    responses: { 201: { description: 'Attendance saved' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/timetable/entries',
    tags: ['Timetable'],
    summary: 'Create conflict-free timetable slot',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createTimetableEntrySchema } } } },
    responses: { 201: { description: 'Timetable entry created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/exams',
    tags: ['Examinations'],
    summary: 'Create examination',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createExamSchema } } } },
    responses: { 201: { description: 'Exam created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/homework',
    tags: ['Homework'],
    summary: 'Create homework assignment',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createHomeworkSchema } } } },
    responses: { 201: { description: 'Homework created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/promotions',
    tags: ['Students'],
    summary: 'Promote, transfer, or withdraw student (with TC sequence)',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: promoteStudentSchema } } } },
    responses: { 201: { description: 'Promotion recorded' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/fees/fee-types',
    tags: ['Fees'],
    summary: 'Create fee type',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createFeeTypeSchema } } } },
    responses: { 201: { description: 'Fee type created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/fees/invoices',
    tags: ['Fees'],
    summary: 'Generate student fee invoice',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createInvoiceSchema } } } },
    responses: { 201: { description: 'Invoice generated' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/fees/payments',
    tags: ['Fees'],
    summary: 'Collect fee payment and allocate to invoices (supports Idempotency-Key)',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: collectPaymentSchema } } } },
    responses: { 201: { description: 'Payment recorded' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/mfa/setup',
    tags: ['Auth'],
    summary: 'Generate TOTP MFA secret and recovery codes',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'MFA setup details' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fees/payments/{id}/receipt.pdf',
    tags: ['Fees'],
    summary: 'Download fee payment receipt PDF',
    security: [{ sessionCookie: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 200: { description: 'PDF receipt' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/exams/report-card/{studentId}.pdf',
    tags: ['Examinations'],
    summary: 'Download published report card PDF',
    security: [{ sessionCookie: [] }],
    request: { params: z.object({ studentId: z.string().uuid() }) },
    responses: { 200: { description: 'PDF report card' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/reports/students.xlsx',
    tags: ['Reports'],
    summary: 'Export student directory Excel workbook',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Excel workbook' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/me/portal',
    tags: ['Portal'],
    summary: 'Get linked parent/student portal summary',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Portal summary' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/accounting/accounts',
    tags: ['Accounting'],
    summary: 'Create chart-of-accounts entry',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createAccountSchema } } } },
    responses: { 201: { description: 'Account created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/accounting/journals',
    tags: ['Accounting'],
    summary: 'Post balanced double-entry journal',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createJournalEntrySchema } } } },
    responses: { 201: { description: 'Journal posted' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/accounting/statements',
    tags: ['Accounting'],
    summary: 'Get reconciled Trial Balance, Income Statement, and Balance Sheet',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Financial statements' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/library/books',
    tags: ['Library'],
    summary: 'Add book title and physical copies',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createBookSchema } } } },
    responses: { 201: { description: 'Book created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/transport/routes',
    tags: ['Transport'],
    summary: 'Create transport route and stops',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createRouteSchema } } } },
    responses: { 201: { description: 'Route created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/hostel',
    tags: ['Hostel'],
    summary: 'Create hostel building',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createHostelSchema } } } },
    responses: { 201: { description: 'Hostel created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/online-exams/banks',
    tags: ['Online Exams'],
    summary: 'Create question bank',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createQuestionBankSchema } } } },
    responses: { 201: { description: 'Question bank created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/online-exams',
    tags: ['Online Exams'],
    summary: 'Schedule online examination',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: createOnlineExamSchema } } } },
    responses: { 201: { description: 'Online exam created' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/website/pages',
    tags: ['Website'],
    summary: 'Create or update school website page',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: upsertWebsitePageSchema } } } },
    responses: { 201: { description: 'Page saved' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/dashboards/summary',
    tags: ['Dashboards'],
    summary: 'Get role-aware school KPI summary',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'Dashboard metrics' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/platform/schools',
    tags: ['Platform'],
    summary: 'Onboard a new school tenant (SaaS Super Admin)',
    security: [{ sessionCookie: [] }],
    request: { body: { content: { 'application/json': { schema: onboardSchoolSchema } } } },
    responses: { 201: { description: 'School onboarded' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/settings/export.json',
    tags: ['Settings'],
    summary: 'Export complete school data package for standalone migration/offboarding',
    security: [{ sessionCookie: [] }],
    responses: { 200: { description: 'School JSON package' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/files/{id}/download',
    tags: ['Files'],
    summary: 'Download or obtain signed URL for a school-owned attachment',
    security: [{ sessionCookie: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: 'Binary file or signed URL', content: { 'application/json': { schema: fileRecordSchema } } },
    },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'School Management System API',
      version: '1.0.0',
      description: 'Multi-tenant & standalone School ERP REST API',
    },
  });
}
