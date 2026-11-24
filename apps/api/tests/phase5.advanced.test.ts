import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { autoGradeObjectiveAnswer, isAttemptExpired } from '../src/modules/onlineExams/onlineExams.routes.js';
import { sanitizeRichHtml } from '../src/modules/website/website.routes.js';

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
});
