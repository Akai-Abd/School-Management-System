import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { buildReceiptPdf, buildReportCardPdf } from '../src/lib/pdf.js';
import { generateTotpAt, generateTotpSecret, verifyTotpCode } from '../src/lib/totp.js';

describe('MVP polish: TOTP MFA, PDFKit output, and new endpoints', () => {
  it('should generate and verify RFC 6238 TOTP codes', () => {
    const secret = generateTotpSecret();
    const now = 1_795_555_000_000;
    const validCode = generateTotpAt(secret, now);

    expect(verifyTotpCode(secret, validCode, now)).toBe(true);
    expect(verifyTotpCode(secret, '000000', now)).toBe(false);
  });

  it('should render valid PDF buffers for receipts and report cards', async () => {
    const receipt = await buildReceiptPdf({
      schoolName: 'Demo Public School',
      receiptNumber: 'RCP-000001',
      paymentDate: '2026-11-25',
      studentName: 'Aarav Sharma',
      admissionNumber: 'ADM-000001',
      amount: '5000.00',
      mode: 'upi',
      allocations: [{ invoiceNumber: 'INV-000001', amount: '5000.00' }],
    });
    expect(receipt.subarray(0, 5).toString()).toBe('%PDF-');

    const reportCard = await buildReportCardPdf({
      schoolName: 'Demo Public School',
      studentName: 'Aarav Sharma',
      admissionNumber: 'ADM-000001',
      results: [
        {
          examName: 'Mid-Term 2026',
          subjectName: 'Mathematics',
          status: 'present',
          marksObtained: '92',
          maxMarks: '100',
          passingMarks: '35',
        },
      ],
    });
    expect(reportCard.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should expose MFA, PDF, Excel, and Portal OpenAPI routes and enforce auth', async () => {
    const app = createApp();
    const openapi = await request(app).get('/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.paths['/api/v1/auth/mfa/setup']).toBeDefined();
    expect(openapi.body.paths['/api/v1/reports/students.xlsx']).toBeDefined();
    expect(openapi.body.paths['/api/v1/me/portal']).toBeDefined();

    expect((await request(app).get('/api/v1/reports/students.xlsx')).status).toBe(401);
    expect((await request(app).get('/api/v1/me/portal')).status).toBe(401);
  });
});
