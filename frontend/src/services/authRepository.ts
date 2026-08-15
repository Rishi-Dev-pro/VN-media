import { mockCreators } from '../data/mockCreators';
import { isApiMode } from './api/apiConfig';
import { httpAuthRepository } from './api/httpAuthRepository';

/* ============================================================
   Auth repository boundary.

   The UI only talks to this interface. Today it is backed by the
   local mock implementation below; in the integration phase a
   `HttpAuthRepository` will implement the same interface against
   the real VN-Media API — the UI will not change.

   No JWT, cookies, tokens or session endpoints are assumed.
   ============================================================ */

export interface AuthUser {
  handle: string;
  name: string;
  avatar: string;
  /** public short bio (editable on /profile) */
  bio?: string;
}

/** Editable public profile fields. */
export interface ProfileInput {
  handle?: string;
  name?: string;
  avatar?: string;
  bio?: string;
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface AuthRepository {
  signIn(email: string, password: string): Promise<AuthResult>;
  register(input: RegisterInput): Promise<AuthResult>;
  /** the signed-in demo listener (session-local) */
  getCurrentUser(): Promise<AuthUser>;
  /** validate + persist public profile edits (mock-only) */
  updateCurrentUser(input: ProfileInput): Promise<AuthResult>;
}

/** Simulated network latency. */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- session-local current user ---------- */

let currentUser: AuthUser = {
  handle: 'you',
  name: 'You',
  avatar: '/images/portrait-7.jpg',
  bio: 'A quiet listener with a library full of night sounds — and a habit of following every voice that makes the city feel smaller.',
};

/** Deterministic username rules mirroring Register + mock uniqueness. */
function validateHandle(handle: string): string | null {
  const h = handle.trim().toLowerCase();
  if (!h) return 'USERNAME IS REQUIRED.';
  if (h.length < 3) return 'USERNAME MUST BE AT LEAST 3 CHARACTERS.';
  if (!/^[a-z0-9._-]+$/i.test(h)) return 'USE LETTERS, NUMBERS, DOTS, DASHES OR UNDERSCORES ONLY.';
  if (h === 'taken') return 'USERNAME ALREADY EXISTS.';
  if (mockCreators.some((c) => c.handle.toLowerCase() === h)) return 'USERNAME ALREADY EXISTS.';
  return null;
}

/**
 * Local demo implementation.
 * - Any well-formed email + password succeeds.
 * - `demo@error.com` intentionally fails so the error UI can be shown.
 *   (Documented here; the integration phase replaces this whole file.)
 */
export const mockAuthRepository: AuthRepository = {
  async signIn(email, password) {
    await delay(1100);

    if (email.toLowerCase() === 'demo@error.com') {
      return {
        ok: false,
        error: "We couldn't sign you in. Check your details and try again.",
      };
    }

    void password;
    return {
      ok: true,
      user: { ...currentUser },
    };
  },

  async getCurrentUser() {
    await delay(420);
    return { ...currentUser };
  },

  async updateCurrentUser(input) {
    await delay(760);

    if (input.handle !== undefined) {
      const problem = validateHandle(input.handle);
      if (problem) {
        return { ok: false, error: problem };
      }
    }

    currentUser = {
      handle: input.handle?.trim().toLowerCase() ?? currentUser.handle,
      name: input.name?.trim() || currentUser.name,
      avatar: input.avatar ?? currentUser.avatar,
      bio: input.bio?.trim() || currentUser.bio,
    };
    return { ok: true, user: { ...currentUser } };
  },

  async register({ username, email, password }) {
    await delay(1200);
    void email;
    void password;

    // `taken` intentionally fails so the error UI can be demonstrated.
    if (username.toLowerCase() === 'taken') {
      return {
        ok: false,
        error: "We couldn't create your account. Please try again.",
      };
    }

    return {
      ok: true,
      user: {
        handle: username.toLowerCase(),
        name: username,
        avatar: '/images/portrait-7.jpg',
      },
    };
  },
};

export function createAuthRepository(): AuthRepository {
  if (isApiMode) return httpAuthRepository;
  return mockAuthRepository;
}
