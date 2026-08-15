/* ============================================================
   Frontend API configuration (Phase 18).

   Single boundary for how the frontend talks to the backend:

     UI → Hook → Repository Interface → HttpRepository → API

   `VITE_DATA_MODE` decides the backing store:
     - "mock" (default) — the deterministic local repositories
     - "api"           — real HTTP implementations against the
                          already-completed VN-Media backend

   There is NEVER a silent fallback from API to mock: an API
   failure surfaces as a real error state with retry.
   ============================================================ */

export type DataMode = 'mock' | 'api';

function readMode(): DataMode {
  try {
    return (import.meta.env.VITE_DATA_MODE as string | undefined) === 'api'
      ? 'api'
      : 'mock';
  } catch {
    return 'mock';
  }
}

export const DATA_MODE: DataMode = readMode();

export const isApiMode = DATA_MODE === 'api';

/** Backend base URL — default matches the backend's development port. */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) ?? 'http://localhost:5000';

/** Socket.IO lives on the same origin/port as the HTTP API. */
export const SOCKET_URL: string = API_BASE_URL;

/** Central API path prefix (backend mounts routes under /api). */
export const API_PREFIX = '/api';
