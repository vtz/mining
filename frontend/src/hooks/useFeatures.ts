'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMines, Mine } from '@/lib/api';

interface UseFeatures {
  mines: Mine[];
  hasFeature: (key: string) => boolean;
  minesWithFeature: (key: string) => Mine[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to check which features are available for the current user's mines.
 *
 * `hasFeature("block_model")` returns true if ANY mine accessible to the user
 * has the `block_model` feature enabled.
 */
export function useFeatures(): UseFeatures {
  const [mines, setMines] = useState<Mine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMines();
      setMines(data.mines ?? []);
    } catch {
      // Not logged in or API unreachable — treat as no features
      setMines([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasFeature = useCallback(
    (key: string): boolean => {
      return mines.some((m) => m.enabled_features?.includes(key));
    },
    [mines],
  );

  const minesWithFeature = useCallback(
    (key: string): Mine[] => {
      return mines.filter((m) => m.enabled_features?.includes(key));
    },
    [mines],
  );

  return useMemo(
    () => ({ mines, hasFeature, minesWithFeature, isLoading, error, refresh: load }),
    [mines, hasFeature, minesWithFeature, isLoading, error, load],
  );
}
