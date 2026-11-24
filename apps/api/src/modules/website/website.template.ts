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

export interface PublicSiteRenderInput {
  school: { name: string; slug: string };
  pageSlug: string;
  customPage?: { title: string; contentHtml: string; seoTitle: string | null; seoDescription: string | null } | null;
  settings?: {
    tagline: string | null;
    principalMessage: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    seoDescription: string | null;
  } | null;
  stats: { students: number; teachers: number; classes: number; books: number };
  teachers: Array<{ fullName: string; specialization: string | null }>;
  classes: Array<{ name: string; code: string | null }>;
  announcements: Array<{ title: string; body: string; createdAt: Date }>;
  events: Array<{ title: string; eventDate: Date; description: string | null }>;
  loginUrl: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

const NAV_ITEMS: Array<[string, string]> = [
  ['home', 'Home'],
  ['about', 'About'],
  ['academics', 'Academics'],
  ['classes', 'Classes'],
  ['teachers', 'Teachers'],
  ['admissions', 'Admissions'],
  ['events', 'Events'],
  ['news', 'News'],
  ['gallery', 'Gallery'],
  ['contact', 'Contact'],
];

const GALLERY_CARDS: Array<[string, string]> = [
  ['Computer Lab', '/public/assets/images/gallery-4.svg'],
  ['Annual Sports Day', '/public/assets/images/gallery-3.svg'],
  ['Library Reading Hour', '/public/assets/images/gallery-2.svg'],
  ['Science Laboratory', '/public/assets/images/gallery-1.svg'],
];

export function renderPublicSchoolSite(input: PublicSiteRenderInput): string {
  const { school, pageSlug, customPage, settings, stats, teachers, classes, announcements, events, loginUrl } = input;
  const base = `/public/${encodeURIComponent(school.slug)}`;
  const schoolName = escapeHtml(school.name);
  const tagline = escapeHtml(settings?.tagline ?? 'A nurturing environment where curiosity meets excellence.');
  const aboutText = escapeHtml(
    settings?.principalMessage ??
      `${school.name} provides a nurturing, technology-enabled learning environment with modern laboratories, library resources, and student-centred instruction.`,
  );
  const pageTitle = escapeHtml(customPage?.seoTitle ?? customPage?.title ?? (pageSlug === 'home' ? 'Home' : pageSlug.replace(/-/g, ' ')));
  const description = escapeHtml(
    customPage?.seoDescription ?? settings?.seoDescription ?? `${school.name} — a modern school management system and public school website.`,
  );
  const canonical = `${base}${pageSlug === 'home' ? '' : `/${encodeURIComponent(pageSlug)}`}`;
  const address = escapeHtml(settings?.address ?? '12 Knowledge Avenue');
  const phone = escapeHtml(settings?.contactPhone ?? '+91-000-000-0000');
  const email = escapeHtml(settings?.contactEmail ?? `info@${escapeHtml(school.slug)}.edu`);

  const navbar = `
<nav class="navbar navbar-expand-xl public-nav sticky-top py-2">
  <div class="container">
    <a class="navbar-brand" href="${base}">
      <img src="/public/assets/images/logo.svg" alt="${schoolName}">
      <span>${schoolName}</span>
    </a>
    <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#publicNav" aria-controls="publicNav" aria-expanded="false" aria-label="Toggle navigation">
      <i class="bi bi-list fs-4"></i>
    </button>
    <div class="collapse navbar-collapse" id="publicNav">
      <ul class="navbar-nav mx-auto">
        ${NAV_ITEMS.map(
          ([slug, label]) =>
            `<li class="nav-item"><a class="nav-link ${pageSlug === slug ? 'active' : ''}" href="${slug === 'home' ? base : `${base}/${slug}`}">${label}</a></li>`,
        ).join('')}
      </ul>
      <div class="d-flex gap-2 mt-3 mt-xl-0">
        <a href="${escapeHtml(loginUrl)}" class="btn btn-primary btn-sm px-3"><i class="bi bi-box-arrow-in-right me-1"></i>Sign In</a>
      </div>
    </div>
  </div>
</nav>`;

  const footer = `
<footer class="public-footer">
  <div class="container">
    <div class="row g-4">
      <div class="col-lg-4">
        <h6 class="d-flex align-items-center gap-2"><img src="/public/assets/images/logo.svg" width="30" height="30" alt=""> ${schoolName}</h6>
        <p class="small mb-2">${tagline}</p>
      </div>
      <div class="col-6 col-lg-2">
        <h6>Explore</h6>
        <ul class="list-unstyled small d-grid gap-2">
          <li><a href="${base}/about">About Us</a></li>
          <li><a href="${base}/academics">Academics</a></li>
          <li><a href="${base}/teachers">Teachers</a></li>
          <li><a href="${base}/gallery">Gallery</a></li>
        </ul>
      </div>
      <div class="col-6 col-lg-2">
        <h6>Admissions</h6>
        <ul class="list-unstyled small d-grid gap-2">
          <li><a href="${base}/admissions">Apply Online</a></li>
          <li><a href="${base}/events">Events</a></li>
          <li><a href="${base}/news">News</a></li>
          <li><a href="${escapeHtml(loginUrl)}">Portal Login</a></li>
        </ul>
      </div>
      <div class="col-lg-4">
        <h6>Contact</h6>
        <ul class="list-unstyled small d-grid gap-2">
          <li><i class="bi bi-geo-alt-fill me-2"></i>${address}</li>
          <li><i class="bi bi-telephone-fill me-2"></i>${phone}</li>
          <li><i class="bi bi-envelope me-2"></i>${email}</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom d-flex flex-wrap justify-content-between gap-2">
      <span>&copy; ${new Date().getUTCFullYear()} ${schoolName}. All rights reserved.</span>
      <span>Powered by EduCore</span>
    </div>
  </div>
</footer>`;

  const displayTeachers = teachers.length > 0 ? teachers : [
    { fullName: 'Senior Faculty', specialization: 'Science & Mathematics' },
    { fullName: 'Academic Lead', specialization: 'Languages & Humanities' },
  ];

  const newsHtml = announcements.length
    ? announcements
        .map(
          (a) => `<div class="border-bottom py-3">
  <div class="text-muted small mb-1"><i class="bi bi-calendar3 me-1"></i>${a.createdAt.toISOString().slice(0, 10)}</div>
  <h6 class="fw-bold mb-1">${escapeHtml(a.title)}</h6>
  <p class="text-muted small mb-0">${escapeHtml(a.body)}</p>
</div>`,
        )
        .join('')
    : '<p class="text-muted small">No announcements published yet.</p>';

  const eventsHtml = events.length
    ? events
        .map((ev) => {
          const d = ev.eventDate;
          const day = String(d.getUTCDate()).padStart(2, '0');
          const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
          return `<div class="d-flex gap-3 border-bottom py-3">
  <div class="text-center bg-primary-subtle text-primary rounded-3 p-2" style="min-width:64px">
    <div class="fw-bold fs-5">${day}</div>
    <div class="small">${mon}</div>
  </div>
  <div>
    <h6 class="fw-bold mb-1">${escapeHtml(ev.title)}</h6>
    <p class="text-muted small mb-0">${escapeHtml(ev.description ?? '')}</p>
  </div>
</div>`;
        })
        .join('')
    : '<p class="text-muted small">No upcoming events scheduled yet.</p>';

  const teacherCardsHtml = (list: typeof displayTeachers) =>
    `<div class="row g-4">${list
      .map(
        (t) => `<div class="col-6 col-lg-3">
  <div class="feature-card text-center">
    <span class="avatar avatar-lg mx-auto mb-3">${escapeHtml(initials(t.fullName))}</span>
    <h6 class="fw-bold mb-1">${escapeHtml(t.fullName)}</h6>
    <div class="text-muted small">${escapeHtml(t.specialization ?? 'Faculty')}</div>
  </div>
</div>`,
      )
      .join('')}</div>`;

  const galleryHtml = `<div class="row g-3">${GALLERY_CARDS.map(
    ([label, src]) => `<div class="col-6 col-lg-3"><a href="${base}/gallery"><img src="${src}" alt="${escapeHtml(label)}" class="img-fluid rounded-4 shadow-sm"></a></div>`,
  ).join('')}</div>`;

  let mainContent = '';
  if (pageSlug === 'home') {
    mainContent = `
<section class="hero">
  <div class="container position-relative">
    <div class="row align-items-center g-5">
      <div class="col-lg-7">
        <div class="section-eyebrow text-white-50 mb-2">Welcome to ${schoolName}</div>
        <h1>Learning Today, Leading Tomorrow</h1>
        <p class="mt-3">${tagline}</p>
        <div class="d-flex flex-wrap gap-2 mt-4">
          <a href="${base}/admissions" class="btn btn-light px-4"><i class="bi bi-pencil-square me-2"></i>Apply for Admission</a>
          <a href="${base}/about" class="btn btn-outline-light px-4">Learn More</a>
        </div>
      </div>
      <div class="col-lg-5 d-none d-lg-block">
        <img src="/public/assets/images/slider-1.svg" alt="Campus" class="slider-img" style="border-radius:22px">
      </div>
    </div>
  </div>
</section>

<section class="py-4 bg-white border-bottom">
  <div class="container">
    <div class="row text-center g-3">
      <div class="col-6 col-md-3"><div class="py-2"><div class="fs-3 fw-bold text-primary">${stats.students}</div><div class="small text-muted">Students</div></div></div>
      <div class="col-6 col-md-3"><div class="py-2"><div class="fs-3 fw-bold text-primary">${stats.teachers}</div><div class="small text-muted">Teachers</div></div></div>
      <div class="col-6 col-md-3"><div class="py-2"><div class="fs-3 fw-bold text-primary">${stats.classes}</div><div class="small text-muted">Classes</div></div></div>
      <div class="col-6 col-md-3"><div class="py-2"><div class="fs-3 fw-bold text-primary">${stats.books}</div><div class="small text-muted">Library Books</div></div></div>
    </div>
  </div>
</section>

<section class="public-section">
  <div class="container">
    <div class="row align-items-center g-5">
      <div class="col-lg-6">
        <div class="section-eyebrow">About Our School</div>
        <h2 class="section-heading">A campus built for curiosity and character</h2>
        <div class="text-muted"><p>${aboutText}</p></div>
        <a href="${base}/about" class="btn btn-primary mt-3">Read our story <i class="bi bi-arrow-right ms-1"></i></a>
      </div>
      <div class="col-lg-6">
        <img src="/public/assets/images/about.svg" alt="About our school" class="img-fluid">
      </div>
    </div>
  </div>
</section>

<section class="public-section bg-white">
  <div class="container">
    <div class="text-center mb-5">
      <div class="section-eyebrow">Why EduCore</div>
      <h2 class="section-heading">Everything a modern school needs</h2>
    </div>
    <div class="row g-4">
      <div class="col-md-6 col-lg-3"><div class="feature-card"><i class="bi bi-flask"></i><h5 class="mt-3 fw-bold">Modern Labs</h5><p class="text-muted small mb-0">Well-equipped science and computing laboratories for hands-on learning.</p></div></div>
      <div class="col-md-6 col-lg-3"><div class="feature-card"><i class="bi bi-book-half"></i><h5 class="mt-3 fw-bold">Rich Library</h5><p class="text-muted small mb-0">Thousands of titles and a reading programme that builds lifelong learners.</p></div></div>
      <div class="col-md-6 col-lg-3"><div class="feature-card"><i class="bi bi-people-fill"></i><h5 class="mt-3 fw-bold">Expert Faculty</h5><p class="text-muted small mb-0">Experienced, caring teachers focused on every student's progress.</p></div></div>
      <div class="col-md-6 col-lg-3"><div class="feature-card"><i class="bi bi-bus-front-fill"></i><h5 class="mt-3 fw-bold">Safe Transport</h5><p class="text-muted small mb-0">Reliable bus routes with trained drivers across the city.</p></div></div>
    </div>
  </div>
</section>

<section class="public-section">
  <div class="container">
    <div class="d-flex flex-wrap justify-content-between align-items-end mb-4">
      <div><div class="section-eyebrow">Our Team</div><h2 class="section-heading mb-0">Meet our teachers</h2></div>
      <a href="${base}/teachers" class="btn btn-outline-secondary btn-sm">View all teachers</a>
    </div>
    ${teacherCardsHtml(displayTeachers.slice(0, 4))}
  </div>
</section>

<section class="public-section bg-white">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-6">
        <div class="d-flex justify-content-between align-items-end mb-3"><h2 class="section-heading mb-0">Latest news</h2><a href="${base}/news" class="small">All news</a></div>
        ${newsHtml}
      </div>
      <div class="col-lg-6">
        <div class="d-flex justify-content-between align-items-end mb-3"><h2 class="section-heading mb-0">Upcoming events</h2><a href="${base}/events" class="small">All events</a></div>
        ${eventsHtml}
      </div>
    </div>
  </div>
</section>

<section class="public-section">
  <div class="container">
    <div class="text-center mb-4"><div class="section-eyebrow">Campus Life</div><h2 class="section-heading">From our gallery</h2></div>
    ${galleryHtml}
  </div>
</section>

<section class="py-5" style="background:linear-gradient(120deg,#1e1b4b,#4338ca)">
  <div class="container text-center text-white py-3">
    <h2 class="fw-bold mb-2">Ready to join our community?</h2>
    <p class="text-white-50 mb-4">Admissions are open for the current academic session.</p>
    <a href="${base}/admissions" class="btn btn-light px-4"><i class="bi bi-pencil-square me-2"></i>Start your application</a>
  </div>
</section>`;
  } else {
    let subBody = '';
    if (customPage) {
      subBody = `<div class="feature-card">${sanitizeRichHtml(customPage.contentHtml)}</div>`;
    } else if (pageSlug === 'classes' || pageSlug === 'academics') {
      subBody = classes.length
        ? `<div class="row g-4">${classes.map((c) => `<div class="col-md-6 col-lg-3"><div class="feature-card"><h5 class="fw-bold">${escapeHtml(c.name)}</h5><p class="text-muted small mb-0">${escapeHtml(c.code ?? 'Standard Curriculum')}</p></div></div>`).join('')}</div>`
        : '<div class="feature-card"><p class="text-muted mb-0">Academic classes are being configured for this session.</p></div>';
    } else if (pageSlug === 'teachers') {
      subBody = teacherCardsHtml(displayTeachers);
    } else if (pageSlug === 'news') {
      subBody = `<div class="feature-card">${newsHtml}</div>`;
    } else if (pageSlug === 'events') {
      subBody = `<div class="feature-card">${eventsHtml}</div>`;
    } else if (pageSlug === 'gallery') {
      subBody = galleryHtml;
    } else if (pageSlug === 'contact' || pageSlug === 'admissions') {
      subBody = `<div class="feature-card"><h5 class="fw-bold mb-3">${escapeHtml(pageSlug === 'admissions' ? 'Admissions Inquiry' : 'School Contact')}</h5><p class="text-muted">${aboutText}</p><p class="mb-0"><strong>Address:</strong> ${address}<br/><strong>Phone:</strong> ${phone}<br/><strong>Email:</strong> ${email}</p></div>`;
    } else {
      subBody = `<div class="feature-card"><p class="text-muted mb-0">${aboutText}</p></div>`;
    }

    mainContent = `
<section class="page-hero">
  <div class="container">
    <nav aria-label="breadcrumb" class="mb-2">
      <ol class="breadcrumb small">
        <li class="breadcrumb-item"><a href="${base}">Home</a></li>
        <li class="breadcrumb-item active text-capitalize" aria-current="page">${pageTitle}</li>
      </ol>
    </nav>
    <h1 class="text-capitalize mb-0">${pageTitle}</h1>
  </div>
</section>
<section class="public-section"><div class="container">${subBody}</div></section>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle} | ${schoolName}</title>
  <meta name="description" content="${description}" />
  <link rel="icon" type="image/svg+xml" href="/public/assets/images/logo.svg" />
  <link rel="canonical" href="${canonical}" />
  <link rel="stylesheet" href="/public/assets/css/bootstrap.min.css" />
  <link rel="stylesheet" href="/public/assets/css/bootstrap-icons.css" />
  <link rel="stylesheet" href="/public/assets/css/educore.css" />
</head>
<body>
${navbar}
${mainContent}
${footer}
<script src="/public/assets/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}
