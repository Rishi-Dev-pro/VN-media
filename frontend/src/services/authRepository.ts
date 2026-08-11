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
}

/** Simulated network latency. */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
      user: {
        handle: 'you',
        name: 'You',
        avatar: '/images/portrait-7.jpg',
      },
    };
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
  return mockAuthRepository;
}
