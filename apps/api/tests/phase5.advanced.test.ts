import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { autoGradeObjectiveAnswer, isAttemptExpired } from '../src/modules/onlineExams/onlineExams.routes.js';
import { sanitizeRichHtml } from '../src/modules/website/website.routes.js';
import { renderPublicSchoolSite } from '../src/modules/website/website.template.js';

describe('Phase 5 online exams, SSR website, and role dashboards', () => {
  it('should enforce server-side online exam expiry and objective auto-grading (M08-AC2/AC4)', () => {
    const now = new Date('2026-11-25T10:00:00Z');
    expect(isAttemptExpired(new Date('2026-11-25T10:05:00Z'), now)).toBe(false);
    expect(isAttemptExpired(new Date('2026-11-25T09:59:59Z'), now)).toBe(true);

    const opts = [
      { id: 'o1', isCorrect: true },
      { id: 'o2', isCorrect: false },
      { id: 'o3', isCorrect: true },
    ];
    expect(autoGradeObjectiveAnswer('msq', opts, ['o1', 'o3'], 4)).toBe(4);
    expect(autoGradeObjectiveAnswer('msq', opts, ['o1'], 4)).toBe(0);
    expect(autoGradeObjectiveAnswer('descriptive', opts, [], 10)).toBeNull();
  });

  it('should sanitize website rich HTML against XSS payloads (M17-AC6)', () => {
    const dirty = '<p onclick="alert(1)">Hello</p><script>steal()</script><a href="javascript:alert(2)">Link</a>';
    const clean = sanitizeRichHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('should expose Phase 5 OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/online-exams']).toBeDefined();
    expect(openapi.body.paths['/api/v1/website/pages']).toBeDefined();
    expect(openapi.body.paths['/api/v1/dashboards/summary']).toBeDefined();

    expect((await request(app).get('/api/v1/online-exams')).status).toBe(401);
    expect((await request(app).get('/api/v1/website')).status).toBe(401);
    expect((await request(app).get('/api/v1/dashboards/summary')).status).toBe(401);
  });

  it('should render EduCore-style public SSR landing page with SEO tags and escaped content (M17-AC5/AC6)', () => {
    const html = renderPublicSchoolSite({
      school: { name: 'Demo <High> School', slug: 'demo-school' },
      pageSlug: 'home',
      stats: { students: 120, teachers: 15, classes: 10, books: 500 },
      teachers: [{ fullName: 'Priya Sharma', specialization: 'Mathematics' }],
      classes: [{ name: 'Grade 1', code: 'G1' }],
      announcements: [{ title: 'PTM <script>alert(1)</script>', body: 'Friday 10 AM', createdAt: new Date('2026-11-18') }],
      events: [{ title: 'Sports Day', eventDate: new Date('2026-12-02'), description: 'School Ground' }],
      loginUrl: 'http://localhost:5173/login',
    });

    expect(html).toContain('Learning Today, Leading Tomorrow');
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<link rel="canonical" href="/public/demo-school"');
    expect(html).toContain('Priya Sharma');
    expect(html).toContain('Sports Day');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('should render public admissions page form and escape error alerts', () => {
    const html = renderPublicSchoolSite({
      school: { name: 'EduCore Demo', slug: 'demo-school' },
      pageSlug: 'admissions',
      stats: { students: 8, teachers: 3, classes: 6, books: 4 },
      teachers: [],
      classes: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Class 6', code: 'C6' }],
      announcements: [],
      events: [],
      admissionFeedback: { error: '<script>xss()</script>Bad input' },
      loginUrl: '/login',
    });

    expect(html).toContain('Online Admission Application');
    expect(html).toContain('action="/public/demo-school/admissions/apply"');
    expect(html).toContain('Class 6');
    expect(html).not.toContain('<script>xss()</script>');
  });

  it('should render public contact page form and school contact cards', () => {
    const html = renderPublicSchoolSite({
      school: { name: 'EduCore Demo', slug: 'demo-school' },
      pageSlug: 'contact',
      settings: {
        tagline: null,
        principalMessage: null,
        contactEmail: 'info@educore.com',
        contactPhone: '+977-1-5551234',
        address: '12 Knowledge Avenue',
        seoDescription: null,
      },
      stats: { students: 8, teachers: 3, classes: 6, books: 4 },
      teachers: [],
      classes: [],
      announcements: [],
      events: [],
      admissionFeedback: { submitted: true },
      loginUrl: '/login',
    });

    expect(html).toContain('Contact Us');
    expect(html).toContain('We would love to hear from you');
    expect(html).toContain('action="/public/demo-school/contact/submit"');
    expect(html).toContain('12 Knowledge Avenue');
    expect(html).toContain('Your message has been sent');
  });

  it('should render classes, news & notices, and detailed teacher cards', () => {
    const classesHtml = renderPublicSchoolSite({
      school: { name: 'EduCore Demo', slug: 'demo-school' },
      pageSlug: 'classes',
      stats: { students: 8, teachers: 3, classes: 1, books: 4 },
      teachers: [],
      classes: [{ id: '1', name: 'Class 9', code: 'C9', studentCount: 2, sections: ['A', 'B'], subjects: ['Mathematics', 'Science'] }],
      announcements: [],
      events: [],
      loginUrl: '/login',
    });
    expect(classesHtml).toContain('2 students');
    expect(classesHtml).toContain('Sections: A, B');
    expect(classesHtml).toContain('Mathematics');

    const newsHtml = renderPublicSchoolSite({
      school: { name: 'EduCore Demo', slug: 'demo-school' },
      pageSlug: 'news',
      stats: { students: 8, teachers: 3, classes: 1, books: 4 },
      teachers: [],
      classes: [],
      announcements: [{ title: 'Staff Workshop', body: 'Monday 2 PM', createdAt: new Date('2026-11-20') }],
      events: [],
      loginUrl: '/login',
    });
    expect(newsHtml).toContain('News &amp; Notices');
    expect(newsHtml).toContain('Staff Workshop');

    const teachersHtml = renderPublicSchoolSite({
      school: { name: 'EduCore Demo', slug: 'demo-school' },
      pageSlug: 'teachers',
      stats: { students: 8, teachers: 3, classes: 1, books: 4 },
      teachers: [{ fullName: 'David Miller', designation: 'Senior Teacher', specialization: 'Science', qualifications: 'M.Sc. Physics', experienceYears: 8 }],
      classes: [],
      announcements: [],
      events: [],
      loginUrl: '/login',
    });
    expect(teachersHtml).toContain('Our Teachers');
    expect(teachersHtml).toContain('Senior Teacher');
    expect(teachersHtml).toContain('M.Sc. Physics');
    expect(teachersHtml).toContain('8 years experience');
  });
});
