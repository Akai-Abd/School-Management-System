import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { recordAuditLog } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { buildStorageKey, createStorageAdapter, detectAllowedMime } from '../../lib/storage.js';
import { requireAuth, requireCsrf, requirePermission, requireSchoolContext } from '../../middleware/auth.js';

const uploadMetaSchema = z.object({
  visibility: z.enum(['private', 'public']).default('private'),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().uuid().optional(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

export const filesRouter = Router();
const storage = createStorageAdapter();

filesRouter.use(requireAuth, requireSchoolContext);

filesRouter.post(
  '/',
  requireCsrf,
  requirePermission('files.create'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw Errors.badRequest('File is required');
      }
      const meta = uploadMetaSchema.parse(req.body);
      const mimeType = detectAllowedMime(req.file.buffer);
      const schoolId = req.auth!.activeSchoolId!;
      const storageKey = buildStorageKey(schoolId, mimeType);

      await storage.putObject({
        key: storageKey,
        body: req.file.buffer,
        contentType: mimeType,
      });

      const created = await req.tenantPrisma!.attachment.create({
        data: {
          schoolId,
          uploadedByUserId: req.auth!.userId,
          originalName: req.file.originalname.slice(0, 255),
          storageKey,
          storageProvider: storage.provider,
          visibility: meta.visibility,
          mimeType,
          sizeBytes: req.file.size,
          entityType: meta.entityType ?? null,
          entityId: meta.entityId ?? null,
        },
      });

      await recordAuditLog({
        schoolId,
        actorUserId: req.auth!.userId,
        action: 'file.upload',
        entityType: 'attachment',
        entityId: created.id,
        ipAddress: req.ip,
        requestId: req.requestId,
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

filesRouter.get('/:id/download', requirePermission('files.view'), async (req, res, next) => {
  try {
    const file = await req.tenantPrisma!.attachment.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File not found');

    const download = await storage.getDownload(file.storageKey);
    if (download.kind === 'signedUrl' && download.url) {
      return res.json({ url: download.url });
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    return res.send(download.buffer);
  } catch (err) {
    next(err);
  }
});

filesRouter.delete('/:id', requireCsrf, requirePermission('files.archive'), async (req, res, next) => {
  try {
    const file = await req.tenantPrisma!.attachment.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File not found');

    await req.tenantPrisma!.attachment.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });
    await storage.deleteObject(file.storageKey);

    await recordAuditLog({
      schoolId: req.auth!.activeSchoolId!,
      actorUserId: req.auth!.userId,
      action: 'file.delete',
      entityType: 'attachment',
      entityId: file.id,
      ipAddress: req.ip,
      requestId: req.requestId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
