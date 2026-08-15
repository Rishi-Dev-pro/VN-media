/* ============================================================
   HTTP auth repository (Phase 18, API mode).

   Talks to the real backend through the central API client:
     POST /api/auth/register   → 201 { user }
     POST /api/auth/login      → 200 { token, user }
     GET  /api/users/me        → 200 { user }
     PATCH /api/users/me       → 200 { user }

   Register succeeds without a token (backend contract), so the
   repository immediately logs the new account in to establish
   the session — the Register UX keeps working unchanged.

   Token + current user live in the session store (sessionStorage).
   ============================================================ */

import { apiRequest, ApiError } from './apiClient';
import {
  clearSession,
  getSessionUser,
  setSessionUser,
  setToken,
  toAuthUser,
  type SessionUser,
} from './session';
import type { AuthRepository, ProfileInput, RegisterInput } from '../authRepository';

export const httpAuthRepository: AuthRepository = {
  async signIn(email, password) {
    try {
      const data = await apiRequest<{ token: string; user: SessionUser }>(
        '/auth/login',
        { method: 'POST', body: { email, password }, auth: false },
        "WE COULDN'T SIGN YOU IN. CHECK YOUR DETAILS.",
      );
      setToken(data.token);
      setSessionUser(data.user);
      return { ok: true, user: toAuthUser(data.user) };
    } catch (err) {
      return { ok: false, error: errorText(err) };
    }
  },

  async register(input: RegisterInput) {
    try {
      // 1) create the account (no token returned by the backend)
      await apiRequest(
        '/auth/register',
        { method: 'POST', body: input, auth: false },
        "WE COULDN'T CREATE YOUR ACCOUNT. PLEASE TRY AGAIN.",
      );
      // 2) establish the session so the rest of the app works immediately
      const login = await this.signIn(input.email, input.password);
      if (!login.ok) {
        return { ok: false, error: 'Account created — sign in to continue.' };
      }
      return login;
    } catch (err) {
      return { ok: false, error: errorText(err) };
    }
  },

  async getCurrentUser() {
    const cached = getSessionUser();
    if (cached) return toAuthUser(cached);
    if (!sessionTokenPresent()) {
      throw new Error('Not signed in.');
    }
    const data = await apiRequest<{ user: SessionUser }>('/users/me');
    setSessionUser(data.user);
    return toAuthUser(data.user);
  },

  async updateCurrentUser(input: ProfileInput) {
    try {
      const data = await apiRequest<{ user: SessionUser }>('/users/me', {
        method: 'PATCH',
        body: {
          username: input.handle?.trim() || undefined,
          avatar: input.avatar ?? undefined,
          bio: input.bio?.trim() || undefined,
        },
      });
      setSessionUser(data.user);
      return { ok: true, user: toAuthUser(data.user) };
    } catch (err) {
      return { ok: false, error: errorText(err) };
    }
  },
};

/** Map any error into a product-safe message (never internals). */
function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'INVALID EMAIL OR PASSWORD.';
    if (err.status === 409) return 'THAT DETAIL IS ALREADY TAKEN.';
    return err.message;
  }
  return 'SIGNAL LOST. CHECK YOUR CONNECTION AND TRY AGAIN.';
}

function sessionTokenPresent(): boolean {
  try {
    return Boolean(window.sessionStorage.getItem('vn.auth.token.v1'));
  } catch {
    return false;
  }
}

/** Used by the logout flow — drop the auth session server/client side. */
export function logoutLocal(): void {
  clearSession();
}
