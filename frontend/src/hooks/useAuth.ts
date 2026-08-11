import { useCallback, useRef, useState } from 'react';
import { createAuthRepository } from '../services/authRepository';

const repo = createAuthRepository();

export type AuthStatus = 'idle' | 'submitting' | 'success' | 'error';

interface UseAuth {
  status: AuthStatus;
  /** top-level message for the error banner */
  error: string | null;
  /** submit credentials; resolves true when the demo sign-in succeeded */
  signIn: (email: string, password: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * Frontend-only authentication state. The repository boundary makes
 * swapping in the real backend a later, isolated step.
 */
export function useAuth(): UseAuth {
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const signIn = useCallback(async (email: string, password: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setStatus('submitting');
    setError(null);

    const result = await repo.signIn(email, password);

    inFlight.current = false;
    if (result.ok) {
      setStatus('success');
      return true;
    }
    setStatus('error');
    setError(result.error);
    return false;
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, signIn, reset };
}
