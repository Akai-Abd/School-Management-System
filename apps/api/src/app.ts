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
import { authRouter } from './modules/auth/auth.routes.js';
import { filesRouter } from './modules/files/files.routes.js';

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
  app.use('/api/v1/files', filesRouter);

  app.use((_req, _res, next) => {
    next(Errors.notFound('Endpoint not found'));
  });

  app.use(errorHandler);
  return app;
}
