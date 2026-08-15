/* ============================================================
   Central API client (Phase 18).

   Every HTTP repository goes through this one client so auth
   headers, error normalization, JSON parsing and 401 handling
   live in exactly one place. Repositories never hand-roll fetch.

   Errors are normalized into product-safe ApiErrors:
     { status, message, body }

   A 401 on an *authenticated* request means the session is gone
   (expired / revoked via tokenVersion): the session is cleared
   centrally and subscribers react. Login attempts are exempt
   (they send their own credentials and expect 401 on failure).
   ============================================================ */

import { API_BASE_URL, API_PREFIX } from './apiConfig';
import { clearSession, getToken } from './session';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** appended as URL-encoded query params (undefined values skipped) */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body (skip when using formData) */
  body?: unknown;
  /** multipart/form-data (audio uploads) */
  formData?: FormData;
  /** attach the Bearer token (default: true — public GETs can opt out) */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // absolute URLs (e.g. media stream sources) pass through untouched
  const base = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${API_PREFIX}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}${qs.startsWith('?') ? '' : '?'}${qs}` : base;
}

/** Product-safe message per HTTP status (backend messages win when present). */
export function messageForStatus(status: number, fallback: string): string {
  switch (status) {
    case 401: return 'YOUR SESSION EXPIRED. SIGN IN AGAIN.';
    case 403: return 'NOT AUTHORIZED.';
    case 404: return 'CONTENT NOT FOUND.';
    case 409: return 'CONFLICT. PLEASE REFRESH AND TRY AGAIN.';
    case 413: return 'THAT FILE IS TOO LARGE.';
    case 429: return 'TOO MANY REQUESTS. TRY AGAIN IN A MOMENT.';
    case 503: return 'SERVICE UNAVAILABLE. TRY AGAIN LATER.';
    case 500: return 'SIGNAL LOST. TRY AGAIN.';
    default: return fallback || 'SIGNAL LOST. TRY AGAIN.';
  }
}

/** Parse a backend error body into a safe message (no internals leak). */
function errorMessage(status: number, body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  return messageForStatus(status, fallback);
}

async function handleResponse(
  response: Response,
  options: RequestOptions,
  fallback: string,
): Promise<Response> {
  if (response.ok) return response;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error body */
  }

  // Session expired / revoked on an authenticated request → clear it once.
  if (response.status === 401 && options.auth !== false) {
    clearSession();
  }

  throw new ApiError(response.status, errorMessage(response.status, body, fallback), body);
}

async function request(path: string, options: RequestOptions, fallback: string): Promise<Response> {
  const headers = new Headers();
  const wantsAuth = options.auth !== false;
  const token = wantsAuth ? getToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const isForm = options.formData !== undefined;
  if (!isForm && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    signal: options.signal,
  };
  if (isForm) init.body = options.formData;
  else if (options.body !== undefined) init.body = JSON.stringify(options.body);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), init);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'NETWORK SIGNAL LOST. CHECK YOUR CONNECTION.', err);
  }

  return handleResponse(response, options, fallback);
}

/** JSON request → typed payload. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  fallback = 'SIGNAL LOST. TRY AGAIN.',
): Promise<T> {
  const response = await request(path, options, fallback);

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as {
    success?: boolean;
    data?: unknown;
    message?: string;
  };
  return (payload.data ?? payload) as T;
}

/** Raw response (audio streaming / downloads) — caller controls consumption. */
export async function apiStream(path: string, options: RequestOptions = {}): Promise<Response> {
  return request(path, options, 'MEDIA UNAVAILABLE.');
}

/** Best-effort HEAD/status probe for the backend health endpoint. */
export async function apiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
