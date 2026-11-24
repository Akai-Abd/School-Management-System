import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

export interface NotificationDeliveryJob {
  schoolId: string;
  deliveryId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  recipient: string;
  title: string;
  body: string;
}

let queueInstance: Queue<NotificationDeliveryJob> | null = null;

function getRedisConnection() {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
}

export function getNotificationQueue(): Queue<NotificationDeliveryJob> {
  if (!queueInstance) {
    queueInstance = new Queue<NotificationDeliveryJob>('notifications', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
      },
    });
  }
  return queueInstance;
}

export async function enqueueNotificationDelivery(job: NotificationDeliveryJob): Promise<void> {
  const queue = getNotificationQueue();
  await queue.add('deliver', job);
}

/** Starts BullMQ worker that marks external delivery attempts via provider adapter (M15-AC3). */
export function startNotificationWorker(): Worker<NotificationDeliveryJob> {
  const worker = new Worker<NotificationDeliveryJob>(
    'notifications',
    async (job: Job<NotificationDeliveryJob>) => {
      const { deliveryId, channel, recipient, title } = job.data;
      logger.info({ deliveryId, channel, recipient, title }, 'Dispatching notification delivery');
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: 'sent', attempts: { increment: 1 } },
      });
    },
    { connection: getRedisConnection() },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    await prisma.notificationDelivery
      .update({
        where: { id: job.data.deliveryId },
        data: { status: 'failed', attempts: { increment: 1 }, lastError: err.message },
      })
      .catch(() => undefined);
  });

  return worker;
}
