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
  teachers: Array<{
    fullName: string;
    specialization: string | null;
    designation?: string | null;
    qualifications?: string | null;
    experienceYears?: number | null;
  }>;
  classes: Array<{
    id?: string;
    name: string;
    code: string | null;
    studentCount?: number;
    sections?: string[];
    subjects?: string[];
  }>;
  announcements: Array<{ title: string; body: string; createdAt: Date }>;
  events: Array<{ title: string; eventDate: Date; description: string | null }>;
  admissionFeedback?: { submitted?: boolean; error?: string | null };
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

function renderFormAlert(feedback: PublicSiteRenderInput['admissionFeedback'], successMessage: string): string {
  if (feedback?.submitted) {
    return `<div class="alert alert-success" role="alert">${escapeHtml(successMessage)}</div>`;
  }
  if (feedback?.error) {
    return `<div class="alert alert-danger" role="alert">${escapeHtml(feedback.error)}</div>`;
  }
  return '';
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
  const { school, pageSlug, customPage, settings, stats, teachers, classes, announcements, events, admissionFeedback, loginUrl } = input;
  const base = `/public/${encodeURIComponent(school.slug)}`;
  const schoolName = escapeHtml(school.name);
  const tagline = escapeHtml(settings?.tagline ?? 'A nurturing environment where curiosity meets excellence.');
  const aboutText = escapeHtml(
    settings?.principalMessage ??
      `${school.name} provides a nurturing, technology-enabled learning environment with modern laboratories, library resources, and student-centred instruction.`,
  );
  const defaultTitleMap: Record<string, string> = {
    home: 'Home',
    contact: 'Contact Us',
    news: 'News & Notices',
    teachers: 'Our Teachers',
  };
  const defaultTitle = defaultTitleMap[pageSlug] ?? pageSlug.replace(/-/g, ' ');
  const pageTitle = escapeHtml(customPage?.seoTitle ?? customPage?.title ?? defaultTitle);
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
        <div class="d-flex gap-3 mt-3">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><i class="bi bi-twitter-x"></i></a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
        </div>
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
      <span>Powered by Abdurrahman</span>
    </div>
  </div>
</footer>`;

  const displayTeachers = teachers.length > 0 ? teachers : [
    { fullName: 'Senior Faculty', specialization: 'Science & Mathematics', designation: 'Senior Teacher', qualifications: null, experienceYears: null },
    { fullName: 'Academic Lead', specialization: 'Languages & Humanities', designation: 'Teacher', qualifications: null, experienceYears: null },
  ];

  function formatDisplayDate(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  const newsHtml = announcements.length
    ? announcements
        .slice(0, 5)
        .map(
          (a) => `<div class="border-bottom py-3">
  <div class="text-muted small mb-1"><i class="bi bi-calendar3 me-1"></i>${formatDisplayDate(a.createdAt)}</div>
  <h6 class="fw-bold mb-1">${escapeHtml(a.title)}</h6>
  <p class="text-muted small mb-0">${escapeHtml(a.body)}</p>
</div>`,
        )
        .join('')
    : '<p class="text-muted small">No announcements published yet.</p>';

  const newsCardsHtml = announcements.length
    ? `<div class="row g-4">${announcements
        .map(
          (a) => `<div class="col-lg-8">
  <div class="feature-card">
    <div class="text-muted small mb-1"><i class="bi bi-calendar3 me-1"></i>${formatDisplayDate(a.createdAt)}</div>
    <h5 class="fw-bold">${escapeHtml(a.title)}</h5>
    <p class="text-muted small mb-0">${escapeHtml(a.body)}</p>
  </div>
</div>`,
        )
        .join('')}</div>`
    : '<div class="feature-card"><p class="text-muted mb-0">No announcements published yet.</p></div>';

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
    } else if (pageSlug === 'classes') {
      subBody = classes.length
        ? `<div class="row g-4">${classes
            .map((c) => {
              const sectionsText = c.sections?.length ? c.sections.map(escapeHtml).join(', ') : 'General';
              const subjectBadges = c.subjects?.length
                ? c.subjects.map((s) => `<span class="badge bg-light text-dark border">${escapeHtml(s)}</span>`).join('')
                : `<span class="badge bg-light text-dark border">${escapeHtml(c.code ?? 'Standard Curriculum')}</span>`;
              return `<div class="col-md-6 col-lg-4">
  <div class="feature-card h-100">
    <div class="d-flex align-items-center justify-content-between">
      <h5 class="fw-bold mb-0">${escapeHtml(c.name)}</h5>
      <span class="badge bg-primary-subtle text-primary">${c.studentCount ?? 0} students</span>
    </div>
    <div class="text-muted small mt-2">Sections: ${sectionsText}</div>
    <hr>
    <div class="small text-muted mb-1">Subjects</div>
    <div class="d-flex flex-wrap gap-1">${subjectBadges}</div>
  </div>
</div>`;
            })
            .join('')}</div>`
        : '<div class="feature-card"><p class="text-muted mb-0">Academic classes are being configured for this session.</p></div>';
    } else if (pageSlug === 'academics') {
      subBody = classes.length
        ? `<div class="row g-4">${classes.map((c) => `<div class="col-md-6 col-lg-3"><div class="feature-card"><h5 class="fw-bold">${escapeHtml(c.name)}</h5><p class="text-muted small mb-0">${escapeHtml(c.code ?? 'Standard Curriculum')}</p></div></div>`).join('')}</div>`
        : '<div class="feature-card"><p class="text-muted mb-0">Academic classes are being configured for this session.</p></div>';
    } else if (pageSlug === 'teachers') {
      subBody = `<div class="row g-4">${displayTeachers
        .map((t) => {
          const metaParts = [
            t.qualifications ? escapeHtml(t.qualifications) : '',
            t.experienceYears && t.experienceYears > 0 ? `${t.experienceYears} years experience` : '',
          ].filter(Boolean);
          return `<div class="col-sm-6 col-lg-4">
  <div class="feature-card text-center h-100">
    <span class="avatar avatar-lg mx-auto mb-3">${escapeHtml(initials(t.fullName))}</span>
    <h5 class="fw-bold mb-1">${escapeHtml(t.fullName)}</h5>
    <div class="text-primary small fw-semibold">${escapeHtml(t.designation ?? 'Teacher')}</div>
    <p class="text-muted small mt-2 mb-1">${escapeHtml(t.specialization ?? 'Faculty')}</p>
    ${metaParts.length ? `<div class="small text-muted">${metaParts.join(' &middot; ')}</div>` : ''}
  </div>
</div>`;
        })
        .join('')}</div>`;
    } else if (pageSlug === 'news') {
      subBody = newsCardsHtml;
    } else if (pageSlug === 'events') {
      subBody = `<div class="feature-card">${eventsHtml}</div>`;
    } else if (pageSlug === 'gallery') {
      subBody = galleryHtml;
    } else if (pageSlug === 'admissions') {
      const hasClasses = classes.some((c) => Boolean(c.id));
      const classOptions = hasClasses
        ? classes
            .filter((c) => c.id)
            .map((c) => `<option value="${escapeHtml(c.id!)}">${escapeHtml(c.name)}</option>`)
            .join('')
        : '<option value="">General Admission (Assigned at assessment)</option>';
      const alertHtml = renderFormAlert(
        admissionFeedback,
        'Your admission application has been submitted. Our admissions team will contact you within two working days.',
      );

      subBody = `${alertHtml}
<div class="row g-5">
  <div class="col-lg-5">
    <div class="section-eyebrow">Admissions</div>
    <h2 class="section-heading">Join ${schoolName}</h2>
    <div class="text-muted"><p>Admissions are open for the current academic session. Please submit the online admission form or visit the school office with the required documents. Our admissions team will contact you within two working days.</p></div>
    <div class="feature-card mt-4">
      <h6 class="fw-bold">How it works</h6>
      <ol class="small text-muted mb-0 ps-3">
        <li class="mb-2">Submit the online application form.</li>
        <li class="mb-2">Our admissions team reviews your details.</li>
        <li class="mb-2">You will be contacted for a placement assessment.</li>
        <li>Complete enrolment at the school office.</li>
      </ol>
    </div>
  </div>
  <div class="col-lg-7">
    <div class="card"><div class="card-body p-4">
      <h5 class="fw-bold mb-3">Online Admission Application</h5>
      <form action="${base}/admissions/apply" method="post" accept-charset="utf-8">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Student name *</label><input type="text" name="studentName" class="form-control" required maxlength="150"></div>
          <div class="col-md-6"><label class="form-label">Date of birth *</label><input type="date" name="dob" class="form-control" required></div>
          <div class="col-md-6"><label class="form-label">Gender</label><select name="gender" class="form-select"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
          <div class="col-md-6"><label class="form-label">Applying for class${hasClasses ? ' *' : ''}</label>
            <select name="classId" class="form-select"${hasClasses ? ' required' : ''}>
              ${hasClasses ? '<option value="">Select class</option>' : ''}
              ${classOptions}
            </select>
          </div>
          <div class="col-md-6"><label class="form-label">Guardian name *</label><input type="text" name="guardianName" class="form-control" required maxlength="150"></div>
          <div class="col-md-6"><label class="form-label">Guardian phone *</label><input type="text" name="phone" class="form-control" required maxlength="50"></div>
          <div class="col-md-6"><label class="form-label">Email address *</label><input type="email" name="email" class="form-control" required maxlength="150"></div>
          <div class="col-md-6"><label class="form-label">Previous school</label><input type="text" name="previousSchool" class="form-control" maxlength="180"></div>
          <div class="col-12"><label class="form-label">Home address</label><input type="text" name="address" class="form-control" maxlength="255"></div>
          <div class="col-12"><label class="form-label">Additional information</label><textarea name="message" class="form-control" rows="3" maxlength="2000"></textarea></div>
          <div class="col-12"><button type="submit" class="btn btn-primary px-4"><i class="bi bi-send-fill me-2"></i>Submit Application</button></div>
        </div>
      </form>
    </div></div>
  </div>
</div>`;
    } else if (pageSlug === 'contact') {
      const alertHtml = renderFormAlert(
        admissionFeedback,
        'Thank you for reaching out. Your message has been sent to our school office.',
      );
      subBody = `${alertHtml}
<div class="row g-5">
  <div class="col-lg-5">
    <div class="section-eyebrow">Contact</div>
    <h2 class="section-heading">We would love to hear from you</h2>
    <div class="text-muted mb-4"><p>${address}<br/>Phone: ${phone}<br/>Email: ${email}</p></div>
    <div class="d-grid gap-3">
      <div class="feature-card d-flex gap-3 align-items-start"><i class="bi bi-geo-alt-fill"></i><div><div class="fw-semibold">Address</div><div class="text-muted small">${address}</div></div></div>
      <div class="feature-card d-flex gap-3 align-items-start"><i class="bi bi-telephone-fill"></i><div><div class="fw-semibold">Phone</div><div class="text-muted small">${phone}</div></div></div>
      <div class="feature-card d-flex gap-3 align-items-start"><i class="bi bi-envelope"></i><div><div class="fw-semibold">Email</div><div class="text-muted small">${email}</div></div></div>
    </div>
  </div>
  <div class="col-lg-7">
    <div class="card"><div class="card-body p-4">
      <h5 class="fw-bold mb-3">Send us a message</h5>
      <form action="${base}/contact/submit" method="post" accept-charset="utf-8">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Your name *</label><input type="text" name="name" class="form-control" required maxlength="150"></div>
          <div class="col-md-6"><label class="form-label">Email *</label><input type="email" name="email" class="form-control" required maxlength="150"></div>
          <div class="col-md-6"><label class="form-label">Phone</label><input type="text" name="phone" class="form-control" maxlength="50"></div>
          <div class="col-md-6"><label class="form-label">Subject</label><input type="text" name="subject" class="form-control" maxlength="180"></div>
          <div class="col-12"><label class="form-label">Message *</label><textarea name="message" class="form-control" rows="5" required maxlength="3000"></textarea></div>
          <div class="col-12"><button type="submit" class="btn btn-primary px-4"><i class="bi bi-send-fill me-2"></i>Send Message</button></div>
        </div>
      </form>
    </div></div>
  </div>
</div>`;
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
