import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  apiErrorSchema,
  authMeResponseSchema,
  fileRecordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  switchSchoolSchema,
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
