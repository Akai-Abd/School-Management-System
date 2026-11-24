import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_MODE: z.enum(['saas', 'standalone']).default('standalone'),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_ORIGIN: z.string().url().default('http://localhost:5173'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://school_erp:school_erp_dev@localhost:5432/school_erp?schema=public'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    SESSION_SECRET: z
      .string()
      .min(16)
      .default('dev-session-secret-change-in-production-32'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().min(1).default('./storage'),
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.SESSION_SECRET.startsWith('dev-')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'Production requires a non-default SESSION_SECRET',
      });
    }
    if (data.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(raw);
}

export const env = loadEnv();
