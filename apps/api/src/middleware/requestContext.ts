import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

export function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).requestId,
  customProps: (req) => {
    const expressReq = req as Request;
    return {
      requestId: expressReq.requestId,
      schoolId: expressReq.auth?.activeSchoolId ?? null,
      userId: expressReq.auth?.userId ?? null,
    };
  },
});
