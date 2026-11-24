import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface OfflineLicenseData {
  schoolSlug: string;
  schoolName: string;
  expiresAt: string;
  graceDays: number;
  modules: string[];
}

export interface VerifiedLicenseResult {
  valid: boolean;
  status: 'valid' | 'grace' | 'expired' | 'invalid_signature';
  data?: OfflineLicenseData;
}

export function signOfflineLicense(
  data: OfflineLicenseData,
  signingSecret = env.SESSION_SECRET,
): { payload: string; signature: string } {
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
  return { payload, signature };
}

export function verifyOfflineLicense(
  payload: string,
  signature: string,
  signingSecret = env.SESSION_SECRET,
  now = new Date(),
): VerifiedLicenseResult {
  const expectedSig = crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
  const bufA = Buffer.from(signature);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, status: 'invalid_signature' };
  }

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OfflineLicenseData;
  const expiryMs = new Date(parsed.expiresAt).getTime();
  const graceMs = expiryMs + (parsed.graceDays ?? 14) * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  if (nowMs <= expiryMs) return { valid: true, status: 'valid', data: parsed };
  if (nowMs <= graceMs) return { valid: true, status: 'grace', data: parsed };
  return { valid: false, status: 'expired', data: parsed };
}
