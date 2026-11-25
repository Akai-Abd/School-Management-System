import express, { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createAdmissionApplicationSchema,
  createContactInquirySchema,
  createWebsiteAnnouncementSchema,
  createWebsiteEventSchema,
  updateAdmissionStatusSchema,
  updateInquiryStatusSchema,
  upsertWebsitePageSchema,
  upsertWebsiteSettingSchema,
} from '@school-erp/contracts';
import { env } from '../../config/env.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { escapeHtml, renderPublicSchoolSite, sanitizeRichHtml } from './website.template.js';

export { escapeHtml, sanitizeRichHtml };

const uuidParamSchema = z.string().uuid();

const PUBLIC_FORM_ERRORS: Record<string, string> = {
  invalid_fields: 'Please check the required fields and try again.',
  invalid_class: 'Selected class is not available for this school.',
};

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

function assertSameOriginIfPresent(req: Request) {
  const origin = req.header('origin');
  if (!origin) return;
  const hostOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin !== env.APP_ORIGIN && origin !== hostOrigin) {
    throw Errors.forbidden('Invalid request origin');
  }
}

export const websiteAdminRouter = Router();
websiteAdminRouter.use(requireAuth, requireSchoolContext, requireModule('website'));

websiteAdminRouter.get('/', requirePermission('website.view'), async (req, res, next) => {
  try {
    const [settings, pages, announcements, events, admissions, inquiries] = await Promise.all([
      req.tenantPrisma!.websiteSetting.findFirst({}),
      req.tenantPrisma!.websitePage.findMany({ orderBy: { slug: 'asc' } }),
      req.tenantPrisma!.websiteAnnouncement.findMany({ orderBy: { createdAt: 'desc' } }),
      req.tenantPrisma!.websiteEvent.findMany({ orderBy: { eventDate: 'asc' } }),
      req.tenantPrisma!.admissionApplication.findMany({
        include: { schoolClass: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      req.tenantPrisma!.contactInquiry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    res.json({ settings, pages, announcements, events, admissions, inquiries });
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

websiteAdminRouter.patch('/admissions/:id', requireCsrf, requirePermission('website.update'), validateBody(updateAdmissionStatusSchema), async (req, res, next) => {
  try {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) throw Errors.badRequest('Invalid application ID');

    const existing = await req.tenantPrisma!.admissionApplication.findFirst({ where: { id: idParsed.data } });
    if (!existing) throw Errors.notFound('Admission application not found');
    const updated = await req.tenantPrisma!.admissionApplication.update({
      where: { id: existing.id },
      data: { status: req.body.status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

websiteAdminRouter.patch('/inquiries/:id', requireCsrf, requirePermission('website.update'), validateBody(updateInquiryStatusSchema), async (req, res, next) => {
  try {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) throw Errors.badRequest('Invalid inquiry ID');

    const existing = await req.tenantPrisma!.contactInquiry.findFirst({ where: { id: idParsed.data } });
    if (!existing) throw Errors.notFound('Contact inquiry not found');
    const updated = await req.tenantPrisma!.contactInquiry.update({
      where: { id: existing.id },
      data: { status: req.body.status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** Unauthenticated server-rendered public school website (M17-AC2..AC6). */
export const publicWebsiteRouter = Router();

const publicFormRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
});

async function requireActivePublicSchool(slug: string) {
  const school = await prisma.school.findFirst({
    where: { slug, status: 'active', deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!school) throw Errors.notFound('School website not found');
  return school;
}

publicWebsiteRouter.post(
  '/:schoolSlug/admissions/apply',
  publicFormRateLimiter,
  express.urlencoded({ extended: false, limit: '32kb' }),
  async (req, res, next) => {
    try {
      assertSameOriginIfPresent(req);
      const school = await requireActivePublicSchool(req.params.schoolSlug!);
      const baseAdmissions = `/public/${encodeURIComponent(school.slug)}/admissions`;

      const parsed = createAdmissionApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.redirect(303, `${baseAdmissions}?code=invalid_fields`);
      }

      const data = parsed.data;
      let validClassId: string | null = null;
      if (data.classId) {
        const cls = await prisma.schoolClass.findFirst({
          where: { id: data.classId, schoolId: school.id, deletedAt: null },
          select: { id: true },
        });
        if (!cls) {
          return res.redirect(303, `${baseAdmissions}?code=invalid_class`);
        }
        validClassId = cls.id;
      }

      await prisma.admissionApplication.create({
        data: {
          schoolId: school.id,
          classId: validClassId,
          studentName: data.studentName,
          dateOfBirth: new Date(`${data.dob}T00:00:00.000Z`),
          gender: data.gender || null,
          guardianName: data.guardianName,
          phone: data.phone,
          email: data.email,
          previousSchool: data.previousSchool || null,
          address: data.address || null,
          message: data.message || null,
        },
      });

      res.redirect(303, `${baseAdmissions}?submitted=1`);
    } catch (err) {
      next(err);
    }
  },
);

publicWebsiteRouter.post(
  '/:schoolSlug/contact/submit',
  publicFormRateLimiter,
  express.urlencoded({ extended: false, limit: '32kb' }),
  async (req, res, next) => {
    try {
      assertSameOriginIfPresent(req);
      const school = await requireActivePublicSchool(req.params.schoolSlug!);
      const baseContact = `/public/${encodeURIComponent(school.slug)}/contact`;

      const parsed = createContactInquirySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.redirect(303, `${baseContact}?code=invalid_fields`);
      }

      const data = parsed.data;
      await prisma.contactInquiry.create({
        data: {
          schoolId: school.id,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          subject: data.subject || null,
          message: data.message,
        },
      });

      res.redirect(303, `${baseContact}?submitted=1`);
    } catch (err) {
      next(err);
    }
  },
);

publicWebsiteRouter.get('/', async (_req, res, next) => {
  try {
    const school = await prisma.school.findFirst({
      where: { status: 'active', deletedAt: null },
      select: { slug: true },
      orderBy: { createdAt: 'asc' },
    });
    res.redirect(school ? `/public/${encodeURIComponent(school.slug)}` : '/login');
  } catch (err) {
    next(err);
  }
});

publicWebsiteRouter.get('/:schoolSlug/:pageSlug?', async (req, res, next) => {
  try {
    const pageSlug = req.params.pageSlug ?? 'home';
    const needsNews = pageSlug === 'home' || pageSlug === 'news';
    const needsEvents = pageSlug === 'home' || pageSlug === 'events';
    const needsStats = pageSlug === 'home';
    const needsTeachers = pageSlug === 'home' || pageSlug === 'teachers';
    const needsClasses = pageSlug === 'classes' || pageSlug === 'academics' || pageSlug === 'admissions';

    const school = await prisma.school.findFirst({
      where: { slug: req.params.schoolSlug, status: 'active', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        websiteSetting: true,
        websiteAnnouncements: needsNews
          ? {
              where: { isPublished: true },
              select: { title: true, body: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: pageSlug === 'news' ? 15 : 5,
            }
          : false,
        websiteEvents: needsEvents
          ? {
              where: { isPublished: true },
              select: { title: true, eventDate: true, description: true },
              orderBy: { eventDate: 'asc' },
              take: pageSlug === 'events' ? 15 : 5,
            }
          : false,
      },
    });
    if (!school) throw Errors.notFound('School website not found');

    const [page, studentsCount, teachersCount, classesCount, booksCount, teacherRows, classRows] = await Promise.all([
      prisma.websitePage.findFirst({
        where: { schoolId: school.id, slug: pageSlug, status: 'published' },
        select: { title: true, contentHtml: true, seoTitle: true, seoDescription: true },
      }),
      needsStats ? prisma.student.count({ where: { schoolId: school.id, status: 'active', deletedAt: null } }) : 0,
      needsStats ? prisma.staff.count({ where: { schoolId: school.id, isTeacher: true, status: 'active', deletedAt: null } }) : 0,
      needsStats ? prisma.schoolClass.count({ where: { schoolId: school.id, deletedAt: null } }) : 0,
      needsStats ? prisma.book.count({ where: { schoolId: school.id } }) : 0,
      needsTeachers
        ? prisma.staff.findMany({
            where: { schoolId: school.id, isTeacher: true, status: 'active', deletedAt: null },
            select: {
              fullName: true,
              designation: { select: { name: true } },
              teacherProfile: { select: { specialization: true, qualifications: true, experienceYears: true } },
            },
            orderBy: { fullName: 'asc' },
            take: pageSlug === 'teachers' ? 24 : 4,
          })
        : [],
      needsClasses
        ? pageSlug === 'classes'
          ? prisma.schoolClass.findMany({
              where: { schoolId: school.id, deletedAt: null },
              select: {
                id: true,
                name: true,
                code: true,
                sections: { where: { deletedAt: null }, select: { name: true }, orderBy: { name: 'asc' } },
                classSubjects: { where: { subject: { deletedAt: null } }, select: { subject: { select: { name: true } } } },
                _count: { select: { enrollments: { where: { status: 'active' } } } },
              },
              orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
              take: 24,
            }).then((rows) =>
              rows.map((c) => ({
                id: c.id,
                name: c.name,
                code: c.code,
                studentCount: c._count.enrollments,
                sections: c.sections.map((s) => s.name),
                subjects: [...new Set(c.classSubjects.map((cs) => cs.subject.name))],
              })),
            )
          : prisma.schoolClass.findMany({
              where: { schoolId: school.id, deletedAt: null },
              select: { id: true, name: true, code: true },
              orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
              take: 24,
            })
        : [],
    ]);

    if (req.params.pageSlug && !page && !BUILTIN_PUBLIC_SLUGS.has(pageSlug)) {
      throw Errors.notFound('Published page not found');
    }

    const rawCode = typeof req.query.code === 'string' ? req.query.code : '';
    const errorMsg = PUBLIC_FORM_ERRORS[rawCode] ?? null;

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
        designation: t.designation?.name ?? null,
        specialization: t.teacherProfile?.specialization ?? null,
        qualifications: t.teacherProfile?.qualifications ?? null,
        experienceYears: t.teacherProfile?.experienceYears ?? null,
      })),
      classes: classRows,
      announcements: Array.isArray(school.websiteAnnouncements) ? school.websiteAnnouncements : [],
      events: Array.isArray(school.websiteEvents) ? school.websiteEvents : [],
      admissionFeedback: pageSlug === 'admissions' || pageSlug === 'contact'
        ? { submitted: req.query.submitted === '1', error: errorMsg }
        : undefined,
      loginUrl: '/login',
    }));
  } catch (err) {
    next(err);
  }
});
