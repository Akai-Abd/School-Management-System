import { describe, expect, it, vi } from 'vitest';
import { apiFetch, getCsrfToken, setCsrfToken } from '../src/api/client';

describe('Web API client', () => {
  it('should attach X-CSRF-Token on mutating requests and omit on GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    setCsrfToken('csrf-abc');
    expect(getCsrfToken()).toBe('csrf-abc');

    await apiFetch('/api/v1/auth/me');
    const getHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(getHeaders.get('X-CSRF-Token')).toBeNull();

    await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    const postHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(postHeaders.get('X-CSRF-Token')).toBe('csrf-abc');

    vi.unstubAllGlobals();
  });
});
