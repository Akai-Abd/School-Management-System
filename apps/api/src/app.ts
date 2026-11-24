import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { errorHandler, Errors } from './lib/errors.js';
import { buildOpenApiDocument } from './lib/openapi.js';
import { prisma } from './lib/prisma.js';
import { attachRequestId, httpLogger } from './middleware/requestContext.js';
import { academicRouter } from './modules/academic/academic.routes.js';
import { accountingRouter } from './modules/accounting/accounting.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardsRouter } from './modules/dashboards/dashboards.routes.js';
import { examsRouter } from './modules/exams/exams.routes.js';
import { feesRouter } from './modules/fees/fees.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { homeworkRouter } from './modules/homework/homework.routes.js';
import { hostelRouter } from './modules/hostel/hostel.routes.js';
import { importsRouter } from './modules/imports/imports.routes.js';
import { libraryRouter } from './modules/library/library.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { onlineExamsRouter } from './modules/onlineExams/onlineExams.routes.js';
import { platformRouter } from './modules/platform/platform.routes.js';
import { promotionsRouter } from './modules/promotions/promotions.routes.js';
import { rbacRouter } from './modules/rbac/rbac.routes.js';
import { meRouter, reportsRouter } from './modules/reports/reports.routes.js';
import { auditLogsRouter, settingsRouter } from './modules/settings/settings.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { studentsRouter } from './modules/students/students.routes.js';
import { timetableRouter } from './modules/timetable/timetable.routes.js';
import { transportRouter } from './modules/transport/transport.routes.js';
import { publicWebsiteRouter, websiteAdminRouter } from './modules/website/website.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(attachRequestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_ORIGIN,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', mode: env.APP_MODE });
  });

  app.get('/readyz', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch (err) {
      next(err);
    }
  });

  const openApiDoc = buildOpenApiDocument();
  app.get('/openapi.json', (_req, res) => res.json(openApiDoc));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/platform', platformRouter);
  app.use('/api/v1/files', filesRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/audit-logs', auditLogsRouter);
  app.use('/api/v1/academic', academicRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/timetable', timetableRouter);
  app.use('/api/v1/exams', examsRouter);
  app.use('/api/v1/homework', homeworkRouter);
  app.use('/api/v1/promotions', promotionsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/fees', feesRouter);
  app.use('/api/v1/accounting', accountingRouter);
  app.use('/api/v1/library', libraryRouter);
  app.use('/api/v1/transport', transportRouter);
  app.use('/api/v1/hostel', hostelRouter);
  app.use('/api/v1/online-exams', onlineExamsRouter);
  app.use('/api/v1/website', websiteAdminRouter);
  app.use('/api/v1/dashboards', dashboardsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/me', meRouter);
  app.use('/public', publicWebsiteRouter);
  app.use('/api/v1/staff', staffRouter);
  app.use('/api/v1/students', studentsRouter);
  app.use('/api/v1/imports', importsRouter);
  app.use('/api/v1', rbacRouter);

  app.use((_req, _res, next) => {
    next(Errors.notFound('Endpoint not found'));
  });

  app.use(errorHandler);
  return app;
}
