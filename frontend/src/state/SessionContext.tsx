import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isApiMode } from '../services/api/apiConfig';
import { getToken, subscribeSession } from '../services/api/session';
import { createAuthRepository } from '../services/authRepository';

/* ============================================================
   Session context (Phase 18).

   Mirrors the auth session store for React. Distinguishes:

     loading        — token present, validating against /users/me
     authenticated  — valid session
     unauthenticated— no session / expired (server 401 or revoked)

   Mock mode is always `authenticated` (the demo listener is signed
   in by construction) — the guard is API-mode only, so Phases 1–17
   UX is untouched.
   ============================================================ */

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

const SessionContext = createContext<SessionStatus>('unauthenticated');

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(() =>
    isApiMode ? (getToken() ? 'loading' : 'unauthenticated') : 'authenticated',
  );
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!isApiMode) return;

    let active = true;

    const hydrate = async (): Promise<void> => {
      if (!getToken()) {
        if (active) setStatus('unauthenticated');
        return;
      }
      try {
        await createAuthRepository().getCurrentUser();
        if (active) setStatus('authenticated');
      } catch {
        if (active) setStatus('unauthenticated');
      }
    };

    void hydrate();

    const unsub = subscribeSession(() => {
      const tokenNow = getToken();
      const current = statusRef.current;
      if (tokenNow) {
        // token (re)set — validate it and flip to authenticated when valid
        if (current !== 'loading') setStatus('loading');
        void hydrate();
      } else if (current !== 'unauthenticated') {
        setStatus('unauthenticated');
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  return <SessionContext.Provider value={status}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionStatus {
  return useContext(SessionContext);
}
