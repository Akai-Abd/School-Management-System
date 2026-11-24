import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { calculateOverdueFine } from '../src/modules/library/library.routes.js';
import { assertVehicleCapacity } from '../src/modules/transport/transport.routes.js';

describe('Phase 4 library, transport, hostel, and communications', () => {
  it('should compute library overdue fines accurately (M12-AC3)', () => {
    const due = new Date('2026-11-20');
    expect(calculateOverdueFine(due, new Date('2026-11-20'), 10)).toBe(0);
    expect(calculateOverdueFine(due, new Date('2026-11-25'), 10)).toBe(50);
  });

  it('should enforce transport vehicle capacity limits (M13-AC2)', () => {
    expect(() => assertVehicleCapacity(40, 39)).not.toThrow();
    expect(() => assertVehicleCapacity(40, 40)).toThrow();
  });

  it('should expose Phase 4 OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/library/books']).toBeDefined();
    expect(openapi.body.paths['/api/v1/transport/routes']).toBeDefined();
    expect(openapi.body.paths['/api/v1/hostel']).toBeDefined();

    expect((await request(app).get('/api/v1/library/books')).status).toBe(401);
    expect((await request(app).get('/api/v1/transport/routes')).status).toBe(401);
    expect((await request(app).get('/api/v1/hostel')).status).toBe(401);
    expect((await request(app).get('/api/v1/notifications/messages')).status).toBe(401);
  });
});
