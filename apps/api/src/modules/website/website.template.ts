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

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="38" height="38" aria-hidden="true"><defs><linearGradient id="ecLogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#ecLogo)"/><path d="M32 17 10 27l22 10 22-10-22-10z" fill="#fff"/><path d="M18 32v9c0 4 6 8 14 8s14-4 14-8v-9l-14 6.4L18 32z" fill="#e0f2fe"/><path d="M52 29v11" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="52" cy="43" r="2.5" fill="#fff"/></svg>`;

const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" class="slider-img" role="img" aria-label="Campus overview"><defs><linearGradient id="ecHero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="1200" height="520" rx="28" fill="url(#ecHero)"/><circle cx="1010" cy="90" r="190" fill="rgba(255,255,255,.08)"/><circle cx="150" cy="470" r="160" fill="rgba(255,255,255,.06)"/><text x="70" y="230" font-family="Segoe UI, Arial" font-size="54" font-weight="800" fill="#ffffff">Learning Today</text><text x="72" y="285" font-family="Segoe UI, Arial" font-size="24" fill="rgba(255,255,255,.82)">Leading Tomorrow with Modern Academics</text><rect x="72" y="330" width="180" height="52" rx="26" fill="#ffffff"/><text x="112" y="363" font-family="Segoe UI, Arial" font-size="20" font-weight="700" fill="#4338ca">Learn More</text></svg>`;

const ABOUT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 640" class="img-fluid" role="img" aria-label="Campus illustration"><defs><linearGradient id="ecAbout" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs><rect width="900" height="640" rx="28" fill="url(#ecAbout)"/><rect x="90" y="380" width="720" height="170" rx="18" fill="rgba(255,255,255,.14)"/><rect x="120" y="420" width="180" height="100" rx="10" fill="rgba(255,255,255,.2)"/><rect x="330" y="420" width="180" height="100" rx="10" fill="rgba(255,255,255,.2)"/><rect x="540" y="420" width="180" height="100" rx="10" fill="rgba(255,255,255,.2)"/><circle cx="670" cy="190" r="95" fill="rgba(255,255,255,.12)"/><text x="90" y="150" font-family="Segoe UI, Arial" font-size="44" font-weight="800" fill="#ffffff">A campus built</text><text x="90" y="205" font-family="Segoe UI, Arial" font-size="44" font-weight="800" fill="#ffffff">for curiosity</text><text x="92" y="255" font-family="Segoe UI, Arial" font-size="22" fill="rgba(255,255,255,.8)">Labs, library, sports and safe transport.</text></svg>`;

function galleryCardSvg(title: string, stop1: string, stop2: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" class="img-fluid rounded-4 shadow-sm" role="img" aria-label="${escapeHtml(title)}"><defs><linearGradient id="g_${escapeHtml(title.replace(/\W+/g, ''))}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${stop1}"/><stop offset="1" stop-color="${stop2}"/></linearGradient></defs><rect width="600" height="420" rx="20" fill="url(#g_${escapeHtml(title.replace(/\W+/g, ''))})"/><circle cx="490" cy="90" r="110" fill="rgba(255,255,255,.1)"/><rect x="44" y="294" width="512" height="76" rx="14" fill="rgba(255,255,255,.16)"/><text x="70" y="342" font-family="Segoe UI, Arial" font-size="26" font-weight="700" fill="#ffffff">${escapeHtml(title)}</text></svg>`;
}

const PUBLIC_CSS = `
:root{--primary:#4f46e5;--primary-dark:#4338ca;--primary-soft:#eef2ff;--secondary:#0ea5e9;--teal:#14b8a6;--bg:#f1f5f9;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--radius:16px;--shadow:0 1px 2px rgba(15,23,42,.04),0 12px 30px -16px rgba(15,23,42,.18)}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);font-size:.94rem;line-height:1.6;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}
.container{width:min(1180px,92%);margin:0 auto}
.public-nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.nav-inner{display:flex;align-items:center;gap:18px;min-height:70px;flex-wrap:wrap;padding:8px 0}
.navbar-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem;color:#0f172a}
.nav-links{display:flex;flex-wrap:wrap;gap:4px;margin:0 auto;padding:0;list-style:none}
.nav-link{display:inline-block;color:#475569;font-weight:600;font-size:.84rem;padding:.45rem .78rem;border-radius:8px}
.nav-link:hover,.nav-link.active{color:var(--primary);background:var(--primary-soft)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;font-weight:600;font-size:.86rem;padding:.58rem 1.05rem;border:1px solid transparent;cursor:pointer}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover{background:var(--primary-dark)}
.btn-light{background:#fff;color:var(--primary-dark)}
.btn-outline-light{border-color:rgba(255,255,255,.65);color:#fff}
.btn-outline-secondary{border-color:#cbd5e1;color:#475569;background:#fff}
.hero{background:linear-gradient(120deg,#1e1b4b 0%,#4338ca 55%,#0ea5e9 100%);color:#fff;padding:84px 0;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;width:480px;height:480px;border-radius:50%;background:rgba(255,255,255,.07);right:-120px;top:-140px;pointer-events:none}
.hero h1{font-size:clamp(2rem,4vw,3rem);font-weight:800;letter-spacing:-.02em;margin:0 0 12px;line-height:1.15}
.hero p{color:rgba(255,255,255,.84);font-size:1.04rem;max-width:560px;margin:0}
.grid-2{display:grid;grid-template-columns:1.25fr 1fr;gap:42px;align-items:center}
.grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
.grid-eq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px}
.stats-strip{background:#fff;border-bottom:1px solid var(--border);padding:26px 0;text-align:center}
.stat-num{font-size:1.75rem;font-weight:800;color:var(--primary)}
.stat-lbl{font-size:.82rem;color:var(--muted)}
.public-section{padding:64px 0}
.bg-white{background:#fff}
.section-eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.7rem;font-weight:700;color:var(--teal);margin-bottom:6px}
.section-heading{font-weight:800;font-size:1.65rem;letter-spacing:-.01em;margin:0 0 12px;color:#0f172a}
.feature-card{border:1px solid var(--border);border-radius:var(--radius);background:#fff;padding:24px;height:100%;box-shadow:var(--shadow)}
.feature-card h5,.feature-card h6{margin:12px 0 6px;font-weight:700;font-size:1rem}
.muted{color:var(--muted)}
.avatar-lg{width:76px;height:76px;border-radius:20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:1.35rem;margin-bottom:12px}
.event-row{display:flex;gap:14px;border-bottom:1px solid var(--border);padding:14px 0}
.date-pill{min-width:62px;text-align:center;background:var(--primary-soft);color:var(--primary);border-radius:10px;padding:8px 6px}
.slider-img,.img-fluid{width:100%;height:auto;display:block}
.cta-band{padding:54px 0;background:linear-gradient(120deg,#1e1b4b,#4338ca);color:#fff;text-align:center}
.public-footer{background:#0f172a;color:#94a3b8;padding:52px 0 24px}
.public-footer h6{color:#fff;font-weight:700;margin:0 0 14px;font-size:.95rem}
.public-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:.86rem}
.public-footer a:hover{color:#fff}
.footer-bottom{border-top:1px solid rgba(148,163,184,.16);margin-top:32px;padding-top:18px;font-size:.78rem;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}
.page-hero{background:linear-gradient(120deg,#1e1b4b,#4338ca);color:#fff;padding:48px 0}
.page-hero h1{margin:0 0 6px;font-weight:800;font-size:1.9rem}
@media(max-width:920px){.grid-2,.grid-4,.grid-eq{grid-template-columns:1fr}}
`;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

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
    customPage?.seoDescription ?? settings?.seoDescription ?? `${school.name} — modern school portal and public website.`,
  );
  const canonical = `${base}${pageSlug === 'home' ? '' : `/${encodeURIComponent(pageSlug)}`}`;

  const navItems: Array<[string, string]> = [
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

  const navbar = `
<nav class="public-nav">
  <div class="container nav-inner">
    <a class="navbar-brand" href="${base}">${LOGO_SVG}<span>${schoolName}</span></a>
    <ul class="nav-links">
      ${navItems
        .map(
          ([slug, label]) =>
            `<li><a class="nav-link ${pageSlug === slug ? 'active' : ''}" href="${slug === 'home' ? base : `${base}/${slug}`}">${label}</a></li>`,
        )
        .join('')}
    </ul>
    <a class="btn btn-primary" href="${escapeHtml(loginUrl)}">Sign In</a>
  </div>
</nav>`;

  const footer = `
<footer class="public-footer">
  <div class="container">
    <div class="grid-4">
      <div>
        <h6 style="display:flex;align-items:center;gap:8px">${LOGO_SVG}<span>${schoolName}</span></h6>
        <p style="font-size:.86rem;margin:0">${tagline}</p>
      </div>
      <div>
        <h6>Explore</h6>
        <ul>
          <li><a href="${base}/about">About Us</a></li>
          <li><a href="${base}/academics">Academics</a></li>
          <li><a href="${base}/teachers">Teachers</a></li>
          <li><a href="${base}/gallery">Gallery</a></li>
        </ul>
      </div>
      <div>
        <h6>Admissions</h6>
        <ul>
          <li><a href="${base}/admissions">Apply Online</a></li>
          <li><a href="${base}/events">Events</a></li>
          <li><a href="${base}/news">News</a></li>
          <li><a href="${escapeHtml(loginUrl)}">Portal Login</a></li>
        </ul>
      </div>
      <div>
        <h6>Contact</h6>
        <ul>
          <li>${escapeHtml(settings?.address ?? 'Campus Road, Main Block')}</li>
          <li>${escapeHtml(settings?.contactPhone ?? '+91-000-000-0000')}</li>
          <li>${escapeHtml(settings?.contactEmail ?? `info@${escapeHtml(school.slug)}.edu`)}</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${schoolName}. All rights reserved.</span>
      <span>Powered by School ERP</span>
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
          (a) =>
            `<div style="border-bottom:1px solid var(--border);padding:14px 0"><div class="muted" style="font-size:.78rem">${a.createdAt.toISOString().slice(0, 10)}</div><div style="font-weight:700;margin:2px 0">${escapeHtml(a.title)}</div><div class="muted" style="font-size:.86rem">${escapeHtml(a.body)}</div></div>`,
        )
        .join('')
    : '<p class="muted">No announcements published yet.</p>';

  const eventsHtml = events.length
    ? events
        .map((ev) => {
          const d = ev.eventDate;
          const day = String(d.getUTCDate()).padStart(2, '0');
          const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
          return `<div class="event-row"><div class="date-pill"><div style="font-weight:800;font-size:1.1rem">${day}</div><div style="font-size:.74rem">${mon}</div></div><div><div style="font-weight:700">${escapeHtml(ev.title)}</div><div class="muted" style="font-size:.85rem">${escapeHtml(ev.description ?? '')}</div></div></div>`;
        })
        .join('')
    : '<p class="muted">No upcoming events scheduled yet.</p>';

  let mainContent = '';
  if (pageSlug === 'home') {
    mainContent = `
<section class="hero">
  <div class="container grid-2">
    <div>
      <div class="section-eyebrow" style="color:rgba(255,255,255,.72)">Welcome to ${schoolName}</div>
      <h1>Learning Today, Leading Tomorrow</h1>
      <p>${tagline}</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:24px">
        <a href="${base}/admissions" class="btn btn-light">Apply for Admission</a>
        <a href="${base}/about" class="btn btn-outline-light">Learn More</a>
      </div>
    </div>
    <div>${HERO_SVG}</div>
  </div>
</section>

<section class="stats-strip">
  <div class="container grid-4">
    <div><div class="stat-num">${stats.students}</div><div class="stat-lbl">Students</div></div>
    <div><div class="stat-num">${stats.teachers}</div><div class="stat-lbl">Teachers</div></div>
    <div><div class="stat-num">${stats.classes}</div><div class="stat-lbl">Classes</div></div>
    <div><div class="stat-num">${stats.books}</div><div class="stat-lbl">Library Books</div></div>
  </div>
</section>

<section class="public-section">
  <div class="container grid-2">
    <div>
      <div class="section-eyebrow">About Our School</div>
      <h2 class="section-heading">A campus built for curiosity and character</h2>
      <p class="muted">${aboutText}</p>
      <a href="${base}/about" class="btn btn-primary" style="margin-top:12px">Read our story &rarr;</a>
    </div>
    <div>${ABOUT_SVG}</div>
  </div>
</section>

<section class="public-section bg-white">
  <div class="container">
    <div style="text-align:center;margin-bottom:36px">
      <div class="section-eyebrow">Why Choose Us</div>
      <h2 class="section-heading">Everything a modern school needs</h2>
    </div>
    <div class="grid-4">
      <div class="feature-card"><h5>Modern Labs</h5><p class="muted" style="margin:0;font-size:.86rem">Well-equipped science and computing laboratories for hands-on learning.</p></div>
      <div class="feature-card"><h5>Rich Library</h5><p class="muted" style="margin:0;font-size:.86rem">Curated titles and reading programmes that build lifelong learners.</p></div>
      <div class="feature-card"><h5>Expert Faculty</h5><p class="muted" style="margin:0;font-size:.86rem">Experienced, caring teachers focused on every student's progress.</p></div>
      <div class="feature-card"><h5>Safe Transport</h5><p class="muted" style="margin:0;font-size:.86rem">Reliable bus routes with trained staff and daily attendance tracking.</p></div>
    </div>
  </div>
</section>

<section class="public-section">
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div><div class="section-eyebrow">Our Team</div><h2 class="section-heading" style="margin-bottom:0">Meet our teachers</h2></div>
      <a href="${base}/teachers" class="btn btn-outline-secondary">View all teachers</a>
    </div>
    <div class="grid-4">
      ${displayTeachers
        .slice(0, 4)
        .map(
          (t) =>
            `<div class="feature-card" style="text-align:center"><span class="avatar-lg">${escapeHtml(initials(t.fullName))}</span><h6>${escapeHtml(t.fullName)}</h6><div class="muted" style="font-size:.84rem">${escapeHtml(t.specialization ?? 'Faculty')}</div></div>`,
        )
        .join('')}
    </div>
  </div>
</section>

<section class="public-section bg-white">
  <div class="container grid-eq">
    <div>
      <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:14px"><h2 class="section-heading" style="margin:0">Latest news</h2><a href="${base}/news" style="color:var(--primary);font-size:.84rem">All news</a></div>
      ${newsHtml}
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:14px"><h2 class="section-heading" style="margin:0">Upcoming events</h2><a href="${base}/events" style="color:var(--primary);font-size:.84rem">All events</a></div>
      ${eventsHtml}
    </div>
  </div>
</section>

<section class="public-section">
  <div class="container">
    <div style="text-align:center;margin-bottom:28px"><div class="section-eyebrow">Campus Life</div><h2 class="section-heading">From our gallery</h2></div>
    <div class="grid-4">
      <a href="${base}/gallery">${galleryCardSvg('Computer Lab', '#6d28d9', '#a855f7')}</a>
      <a href="${base}/gallery">${galleryCardSvg('Annual Sports Day', '#b45309', '#f59e0b')}</a>
      <a href="${base}/gallery">${galleryCardSvg('Library Reading Hour', '#0f766e', '#14b8a6')}</a>
      <a href="${base}/gallery">${galleryCardSvg('Science Laboratory', '#4338ca', '#0ea5e9')}</a>
    </div>
  </div>
</section>

<section class="cta-band">
  <div class="container">
    <h2 style="font-weight:800;margin:0 0 8px">Ready to join our community?</h2>
    <p style="color:rgba(255,255,255,.78);margin:0 0 22px">Admissions are open for the current academic session.</p>
    <a href="${base}/admissions" class="btn btn-light">Start your application</a>
  </div>
</section>`;
  } else {
    let subBody = '';
    if (customPage) {
      subBody = sanitizeRichHtml(customPage.contentHtml);
    } else if (pageSlug === 'classes' || pageSlug === 'academics') {
      subBody = classes.length
        ? `<div class="grid-4">${classes.map((c) => `<div class="feature-card"><h5>${escapeHtml(c.name)}</h5><p class="muted">${escapeHtml(c.code ?? 'Standard Curriculum')}</p></div>`).join('')}</div>`
        : '<p class="muted">Academic classes are being configured for this session.</p>';
    } else if (pageSlug === 'teachers') {
      subBody = `<div class="grid-4">${displayTeachers.map((t) => `<div class="feature-card" style="text-align:center"><span class="avatar-lg">${escapeHtml(initials(t.fullName))}</span><h6>${escapeHtml(t.fullName)}</h6><div class="muted">${escapeHtml(t.specialization ?? 'Faculty')}</div></div>`).join('')}</div>`;
    } else if (pageSlug === 'news') {
      subBody = newsHtml;
    } else if (pageSlug === 'events') {
      subBody = eventsHtml;
    } else if (pageSlug === 'gallery') {
      subBody = `<div class="grid-4">${galleryCardSvg('Computer Lab', '#6d28d9', '#a855f7')}${galleryCardSvg('Annual Sports Day', '#b45309', '#f59e0b')}${galleryCardSvg('Library Reading Hour', '#0f766e', '#14b8a6')}${galleryCardSvg('Science Laboratory', '#4338ca', '#0ea5e9')}</div>`;
    } else if (pageSlug === 'contact' || pageSlug === 'admissions') {
      subBody = `<div class="feature-card"><h5>${escapeHtml(pageSlug === 'admissions' ? 'Admissions Inquiry' : 'School Contact')}</h5><p class="muted">${aboutText}</p><p><strong>Address:</strong> ${escapeHtml(settings?.address ?? 'Campus Road, Main Block')}<br/><strong>Phone:</strong> ${escapeHtml(settings?.contactPhone ?? '+91-000-000-0000')}<br/><strong>Email:</strong> ${escapeHtml(settings?.contactEmail ?? `info@${escapeHtml(school.slug)}.edu`)}</p></div>`;
    } else {
      subBody = `<div class="feature-card"><p class="muted">${aboutText}</p></div>`;
    }

    mainContent = `
<section class="page-hero">
  <div class="container">
    <div style="font-size:.82rem;color:rgba(255,255,255,.75);margin-bottom:6px"><a href="${base}">Home</a> / ${pageTitle}</div>
    <h1 style="text-transform:capitalize">${pageTitle}</h1>
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
  <link rel="canonical" href="${canonical}" />
  <style>${PUBLIC_CSS}</style>
</head>
<body>
${navbar}
${mainContent}
${footer}
</body>
</html>`;
}
