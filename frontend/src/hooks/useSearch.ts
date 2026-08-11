import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSearchRepository,
  normalizeQuery,
  type SearchFilter,
  type SearchResults,
} from '../services/searchRepository';

const repo = createSearchRepository();

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

const EMPTY: SearchResults = { voiceNotes: [], creators: [], albums: [], tags: [], total: 0 };
const RECENT_KEY = 'vn-recent-searches';
const RECENT_LIMIT = 6;

function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function persistRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* demo state only — never fatal */
  }
}

export interface UseSearch {
  query: string;
  setQuery: (q: string) => void;
  filter: SearchFilter;
  setFilter: (f: SearchFilter) => void;
  status: SearchStatus;
  error: boolean;
  /** results + the normalized query they belong to (for stale-compare) */
  results: SearchResults;
  resultsFor: string;
  suggestions: SearchResults;
  recent: string[];
  /** run an immediate search and record history (Enter / suggestions / tags) */
  commit: (q: string) => void;
  removeRecent: (q: string) => void;
  clearRecent: () => void;
  retry: () => void;
}

export function useSearch(): UseSearch {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [resultsFor, setResultsFor] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [suggestions, setSuggestions] = useState<SearchResults>(EMPTY);
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const runSearch = useCallback(async (q: string, flt: SearchFilter) => {
    setStatus('loading');
    setSuggestions(EMPTY);
    try {
      const r = await repo.search(q, flt);
      setResults(r);
      setResultsFor(normalizeQuery(q));
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  // Debounced search whenever the query or category changes.
  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setStatus('idle');
      setResults(EMPTY);
      setResultsFor('');
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(q, filter);
    }, 220);
    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    };
  }, [query, filter, runSearch]);

  // Lightweight suggestions while typing.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions(EMPTY);
      return;
    }
    const t = window.setTimeout(() => {
      void repo
        .suggest(q)
        .then(setSuggestions)
        .catch(() => setSuggestions(EMPTY));
    }, 140);
    return () => window.clearTimeout(t);
  }, [query]);

  const addRecent = useCallback((q: string) => {
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_LIMIT);
      persistRecent(next);
      return next;
    });
  }, []);

  const commit = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      addRecent(trimmed);
      void runSearch(trimmed, filter);
    },
    [addRecent, filter, runSearch],
  );

  const removeRecent = useCallback((q: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== q);
      persistRecent(next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    persistRecent([]);
  }, []);

  const retry = useCallback(() => {
    void runSearch(query.trim(), filter);
  }, [query, filter, runSearch]);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    status,
    error: status === 'error',
    results,
    resultsFor,
    suggestions,
    recent,
    commit,
    removeRecent,
    clearRecent,
    retry,
  };
}
