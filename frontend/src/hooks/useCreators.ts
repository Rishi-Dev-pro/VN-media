import { useCallback, useEffect, useState } from 'react';
import { createCreatorRepository, type CreatorProfile } from '../services/creatorRepository';

const repo = createCreatorRepository();

/** Demo switch — `/creators?demo=error` forces the error state. */
function demoError(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === 'error';
  } catch {
    return false;
  }
}

interface CreatorListState {
  creators: CreatorProfile[];
  featured: CreatorProfile | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** Creator discovery: the full catalog + the featured creator. */
export function useCreators(): CreatorListState {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [featured, setFeatured] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const [list, featuredCreator] = await Promise.all([repo.getCreators(), repo.getFeatured()]);
      setCreators(list);
      setFeatured(featuredCreator);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { creators, featured, loading, error, retry };
}

interface CreatorDetailState {
  creator: CreatorProfile | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** Single creator profile for `/creators/:username`. */
export function useCreator(handle: string | undefined): CreatorDetailState {
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!handle) return;
    setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const found = await repo.getByUsername(handle);
      // a missing creator is NOT an error — the page shows the not-found state
      setCreator(found);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    setCreator(null);
    void load();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { creator, loading, error, retry };
}
