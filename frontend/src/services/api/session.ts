/* ============================================================
   Frontend session store (Phase 18, API mode).

   The backend authenticates with a Bearer JWT (HS256, tokenVersion
   revocation, no refresh endpoint) returned by POST /api/auth/login.
   The token lives in sessionStorage — consistent with the rest of
   the app's per-tab session persistence, no refresh path exists,
   and nothing is written to localStorage or exposed in URLs.

   This module is the ONLY place that touches the token. Repositories
   read the current user id from here; components subscribe for
   auth changes (login / logout / session-expired).
   ============================================================ */

import type { AuthUser } from '../authRepository';

const TOKEN_KEY = 'vn.auth.token.v1';
const USER_KEY = 'vn.auth.user.v1';

/** The backend's user DTO (public fields only — no secrets). */
export interface SessionUser {
  id: string;
  username: string;
  email?: string;
  avatar: string | null;
  bio: string;
  createdAt?: string;
}

const listeners = new Set<() => void>();

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null || value === undefined) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* best-effort — auth persistence is not fatal */
  }
}

export function getToken(): string | null {
  return read<string>(TOKEN_KEY);
}

export function setToken(token: string): void {
  write(TOKEN_KEY, token);
  notifySession();
}

export function getSessionUser(): SessionUser | null {
  return read<SessionUser>(USER_KEY);
}

export function setSessionUser(user: SessionUser | null): void {
  write(USER_KEY, user);
  notifySession();
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

/** The authenticated user's backend id (used as creatorId in API mode). */
export function getCurrentUserId(): string | null {
  return getSessionUser()?.id ?? null;
}

/**
 * Map a backend user DTO into the frontend AuthUser contract.
 * The backend user has no separate display name — username is the name.
 */
export function toAuthUser(u: SessionUser): AuthUser {
  return {
    handle: u.username,
    name: u.username,
    avatar: u.avatar ?? '/images/portrait-7.jpg',
    bio: u.bio || '',
  };
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySession(): void {
  listeners.forEach((l) => l());
}

/**
 * Full logout: drop the token + cached user. Callers decide which
 * per-user session keys (player, library, follows) to clear — the
 * auth session itself is cleared here so no stale identity survives.
 */
export function clearSession(): void {
  write(TOKEN_KEY, null);
  write(USER_KEY, null);
  notifySession();
}
