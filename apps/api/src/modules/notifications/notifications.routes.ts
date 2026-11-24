import { Router } from 'express';
import { dispatchNotificationSchema, sendMessageSchema } from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { enqueueNotificationDelivery } from '../../lib/queue.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, requireSchoolContext, requireModule('communications'));

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const [items, deliveries] = await Promise.all([
      req.tenantPrisma!.notification.findMany({
        where: { userId: req.auth!.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      req.tenantPrisma!.notificationDelivery.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
    ]);
    res.json({ items, deliveries });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/dispatch', requireCsrf, requirePermission('communications.create'), validateBody(dispatchNotificationSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const { recipientUserIds, title, body, channel } = req.body;

    const created: Array<{ notificationId: string; deliveryId?: string; recipient: string }> = [];
    for (const userId of recipientUserIds as string[]) {
      const notif = await req.tenantPrisma!.notification.create({
        data: { schoolId, userId, title, body, category: channel },
      });

      if (channel !== 'in_app') {
        const delivery = await req.tenantPrisma!.notificationDelivery.create({
          data: { schoolId, notificationId: notif.id, channel, recipient: userId, status: 'queued' },
        });
        // Non-blocking queue dispatch: failed external queue never destroys in-app notification (M15-AC2)
        await enqueueNotificationDelivery({
          schoolId,
          deliveryId: delivery.id,
          channel,
          recipient: userId,
          title,
          body,
        }).catch(() => undefined);
        created.push({ notificationId: notif.id, deliveryId: delivery.id, recipient: userId });
      } else {
        created.push({ notificationId: notif.id, recipient: userId });
      }
    }

    res.status(201).json({ count: created.length, items: created });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.get('/messages', async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const items = await req.tenantPrisma!.message.findMany({
      where: { OR: [{ recipientUserId: userId }, { senderUserId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/messages', requireCsrf, validateBody(sendMessageSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const msg = await req.tenantPrisma!.message.create({
      data: {
        schoolId,
        senderUserId: req.auth!.userId,
        recipientUserId: req.body.recipientUserId,
        subject: req.body.subject,
        body: req.body.body,
      },
    });
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch('/:id/read', requireCsrf, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw Errors.badRequest('Notification ID is required');
    const item = await req.tenantPrisma!.notification.findFirst({
      where: { id, userId: req.auth!.userId },
    });
    if (!item) throw Errors.notFound('Notification not found');

    await prisma.notification.update({ where: { id: item.id }, data: { isRead: true } });
    res.json({ read: true });
  } catch (err) {
    next(err);
  }
});
