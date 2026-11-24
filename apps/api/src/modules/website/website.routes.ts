import { Router } from 'express';
import {
  createWebsiteAnnouncementSchema,
  createWebsiteEventSchema,
  upsertWebsitePageSchema,
  upsertWebsiteSettingSchema,
} from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { escapeHtml, renderPublicSchoolSite, sanitizeRichHtml } from './website.template.js';

export { escapeHtml, sanitizeRichHtml };

const BUILTIN_PUBLIC_SLUGS = new Set([
  'home',
  'about',
  'academics',
  'classes',
  'teachers',
  'admissions',
  'events',
  'news',
  'gallery',
  'contact',
]);

export const websiteAdminRouter = Router();
websiteAdminRouter.use(requireAuth, requireSchoolContext, requireModule('website'));

websiteAdminRouter.get('/', requirePermission('website.view'), async (req, res, next) => {
  try {
    const [settings, pages, announcements, events] = await Promise.all([
      req.tenantPrisma!.websiteSetting.findFirst({}),
      req.tenantPrisma!.websitePage.findMany({ orderBy: { slug: 'asc' } }),
      req.tenantPrisma!.websiteAnnouncement.findMany({ orderBy: { createdAt: 'desc' } }),
      req.tenantPrisma!.websiteEvent.findMany({ orderBy: { eventDate: 'asc' } }),
    ]);
    res.json({ settings, pages, announcements, events });
  } catch (err) {
    next(err);
  }
});

websiteAdminRouter.put('/settings', requireCsrf, requirePermission('website.update'), validateBody(upsertWebsiteSettingSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const updated = await prisma.websiteSetting.upsert({
      where: { schoolId },
      update: req.body,
      create: { schoolId, ...req.body },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

websiteAdminRouter.post('/pages', requireCsrf, requirePermission('website.create'), validateBody(upsertWebsitePageSchema), async (req, res, next) => {
  try {
    const schoolId = req.auth!.activeSchoolId!;
    const sanitized = sanitizeRichHtml(req.body.contentHtml);
    const page = await prisma.websitePage.upsert({
      where: { schoolId_slug: { schoolId, slug: req.body.slug } },
      update: {
        title: req.body.title,
        contentHtml: sanitized,
        seoTitle: req.body.seoTitle,
        seoDescription: req.body.seoDescription,
        status: req.body.status,
        publishedAt: req.body.status === 'published' ? new Date() : null,
      },
      create: {
        schoolId,
        slug: req.body.slug,
        title: req.body.title,
        contentHtml: sanitized,
        seoTitle: req.body.seoTitle,
        seoDescription: req.body.seoDescription,
        status: req.body.status,
        publishedAt: req.body.status === 'published' ? new Date() : null,
      },
    });
    res.status(201).json(page);
  } catch (err) {
    next(err);
  }
});

websiteAdminRouter.post('/announcements', requireCsrf, requirePermission('website.create'), validateBody(createWebsiteAnnouncementSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.websiteAnnouncement.create({
      data: {
        schoolId: req.auth!.activeSchoolId!,
        title: req.body.title,
        body: req.body.body,
        isPublished: req.body.isPublished,
        publishedAt: req.body.isPublished ? new Date() : null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

websiteAdminRouter.post('/events', requireCsrf, requirePermission('website.create'), validateBody(createWebsiteEventSchema), async (req, res, next) => {
  try {
    const created = await req.tenantPrisma!.websiteEvent.create({
      data: {
        schoolId: req.auth!.activeSchoolId!,
        title: req.body.title,
        eventDate: new Date(`${req.body.eventDate}T00:00:00.000Z`),
        description: req.body.description,
        isPublished: req.body.isPublished,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/** Unauthenticated server-rendered public school website (M17-AC2..AC6). */
export const publicWebsiteRouter = Router();

publicWebsiteRouter.get('/:schoolSlug/:pageSlug?', async (req, res, next) => {
  try {
    const school = await prisma.school.findFirst({
      where: { slug: req.params.schoolSlug, status: 'active', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        websiteSetting: true,
        websiteAnnouncements: {
          where: { isPublished: true },
          select: { title: true, body: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        websiteEvents: {
          where: { isPublished: true },
          select: { title: true, eventDate: true, description: true },
          orderBy: { eventDate: 'asc' },
          take: 5,
        },
      },
    });
    if (!school) throw Errors.notFound('School website not found');

    const pageSlug = req.params.pageSlug ?? 'home';
    const [page, studentsCount, teachersCount, classesCount, booksCount, teacherRows, classRows] = await Promise.all([
      prisma.websitePage.findFirst({
        where: { schoolId: school.id, slug: pageSlug, status: 'published' },
        select: { title: true, contentHtml: true, seoTitle: true, seoDescription: true },
      }),
      prisma.student.count({ where: { schoolId: school.id, status: 'active', deletedAt: null } }),
      prisma.staff.count({ where: { schoolId: school.id, isTeacher: true, status: 'active', deletedAt: null } }),
      prisma.schoolClass.count({ where: { schoolId: school.id, deletedAt: null } }),
      prisma.book.count({ where: { schoolId: school.id } }),
      prisma.staff.findMany({
        where: { schoolId: school.id, isTeacher: true, status: 'active', deletedAt: null },
        select: { fullName: true, teacherProfile: { select: { specialization: true } } },
        orderBy: { fullName: 'asc' },
        take: 8,
      }),
      prisma.schoolClass.findMany({
        where: { schoolId: school.id, deletedAt: null },
        select: { name: true, code: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 12,
      }),
    ]);

    if (req.params.pageSlug && !page && !BUILTIN_PUBLIC_SLUGS.has(pageSlug)) {
      throw Errors.notFound('Published page not found');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPublicSchoolSite({
      school: { name: school.name, slug: school.slug },
      pageSlug,
      customPage: page,
      settings: school.websiteSetting,
      stats: {
        students: studentsCount,
        teachers: teachersCount,
        classes: classesCount,
        books: booksCount,
      },
      teachers: teacherRows.map((t) => ({
        fullName: t.fullName,
        specialization: t.teacherProfile?.specialization ?? null,
      })),
      classes: classRows,
      announcements: school.websiteAnnouncements,
      events: school.websiteEvents,
      loginUrl: '/login',
    }));
  } catch (err) {
    next(err);
  }
});
