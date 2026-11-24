export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

let csrfTokenStore: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenStore = token;
}

export function getCsrfToken(): string | null {
  return csrfTokenStore;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfTokenStore) {
    headers.set('X-CSRF-Token', csrfTokenStore);
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error;
    throw new ApiClientError(
      response.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Request failed with status ${response.status}`,
      err?.details,
    );
  }

  return data as T;
}
