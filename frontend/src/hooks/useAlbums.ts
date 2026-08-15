import { useCallback, useEffect, useState } from 'react';
import {
  createAlbumRepository,
  type AlbumDetail,
  type AlbumSummary,
} from '../services/albumRepository';

const repo = createAlbumRepository();

/** Demo switch — `/albums?demo=error` forces the error state. */
function demoError(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === 'error';
  } catch {
    return false;
  }
}

interface AlbumListState {
  albums: AlbumSummary[];
  featured: AlbumSummary | null;
  /** private collections owned by the demo listener */
  myAlbums: AlbumSummary[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** Album discovery: featured + the public catalog + the listener's own collections. */
export function useAlbums(): AlbumListState {
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [featured, setFeatured] = useState<AlbumSummary | null>(null);
  const [myAlbums, setMyAlbums] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const [list, featuredAlbum, mine] = await Promise.all([
        repo.getAlbums(),
        repo.getFeatured(),
        repo.getMyAlbums(),
      ]);
      setAlbums(list);
      setFeatured(featuredAlbum);
      setMyAlbums(mine);
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

  return { albums, featured, myAlbums, loading, error, retry };
}

interface AlbumDetailState {
  album: AlbumDetail | null;
  loading: boolean;
  /** network/authorization failure — retryable */
  error: boolean;
  /** the album genuinely does not exist (404) — distinct from `error` */
  notFound: boolean;
  retry: () => void;
}

/** Single album view for `/albums/:id`. */
export function useAlbum(id: string | undefined): AlbumDetailState {
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      if (demoError()) throw new Error('demo error');
      const found = await repo.getById(id);
      setAlbum(found);
      if (!found) setNotFound(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setAlbum(null);
    void load();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { album, loading, error, notFound, retry };
}
