import { Router } from 'express';
import {
  createWebsiteAnnouncementSchema,
  upsertWebsitePageSchema,
  upsertWebsiteSettingSchema,
} from '@school-erp/contracts';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireCsrf, requireModule, requirePermission, requireSchoolContext } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strips script/iframe tags, inline on* handlers, and javascript: URIs (M17-AC6). */
export function sanitizeRichHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, 'blocked:');
}

export const websiteAdminRouter = Router();
websiteAdminRouter.use(requireAuth, requireSchoolContext, requireModule('website'));

websiteAdminRouter.get('/', requirePermission('website.view'), async (req, res, next) => {
  try {
    const [settings, pages, announcements] = await Promise.all([
      req.tenantPrisma!.websiteSetting.findFirst({}),
      req.tenantPrisma!.websitePage.findMany({ orderBy: { slug: 'asc' } }),
      req.tenantPrisma!.websiteAnnouncement.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ settings, pages, announcements });
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

/** Unauthenticated server-rendered public school website (M17-AC2..AC6). */
export const publicWebsiteRouter = Router();

publicWebsiteRouter.get('/:schoolSlug/:pageSlug?', async (req, res, next) => {
  try {
    const school = await prisma.school.findFirst({
      where: { slug: req.params.schoolSlug, status: 'active', deletedAt: null },
      include: {
        websiteSetting: true,
        websiteAnnouncements: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!school) throw Errors.notFound('School website not found');

    const pageSlug = req.params.pageSlug ?? 'home';
    const page = await prisma.websitePage.findFirst({
      where: { schoolId: school.id, slug: pageSlug, status: 'published' },
    });

    if (req.params.pageSlug && !page) {
      throw Errors.notFound('Published page not found');
    }

    const title = escapeHtml(page?.seoTitle ?? page?.title ?? school.name);
    const description = escapeHtml(page?.seoDescription ?? school.websiteSetting?.seoDescription ?? school.name);
    const bodyHtml = page ? sanitizeRichHtml(page.contentHtml) : `<p>${escapeHtml(school.websiteSetting?.tagline ?? 'Welcome to our school.')}</p>`;
    const announcementsHtml = school.websiteAnnouncements
      .map((a) => `<li><strong>${escapeHtml(a.title)}</strong>: ${escapeHtml(a.body)}</li>`)
      .join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — ${escapeHtml(school.name)}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="/public/${escapeHtml(school.slug)}${req.params.pageSlug ? `/${escapeHtml(pageSlug)}` : ''}" />
</head>
<body style="font-family:system-ui,sans-serif;max-width:840px;margin:2rem auto;padding:0 1rem;line-height:1.6">
  <header><h1>${escapeHtml(school.name)}</h1></header>
  <main>
    <h2>${escapeHtml(page?.title ?? 'Home')}</h2>
    <div>${bodyHtml}</div>
    ${announcementsHtml ? `<section><h3>Announcements</h3><ul>${announcementsHtml}</ul></section>` : ''}
  </main>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});
