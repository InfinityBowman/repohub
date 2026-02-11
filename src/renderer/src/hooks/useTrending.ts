import { useCallback } from 'react';
import { useTrendingStore } from '@/store/trendingStore';
import type { TrendingRepo, TrendingPeriod } from '@/types';

export function useTrending() {
  const store = useTrendingStore();

  const fetchTrending = useCallback(async (language?: string, period?: TrendingPeriod) => {
    const s = useTrendingStore.getState();
    const lang = language ?? s.language;
    const per = period ?? s.period;

    s.setLoading(true);
    s.setError(null);
    try {
      const repos = await window.electron.github.searchTrending(lang, per);
      useTrendingStore.getState().setRepos(repos);
      useTrendingStore.getState().setLastFetch(Date.now());
    } catch (err: any) {
      useTrendingStore.getState().setError(err.message || 'Failed to fetch trending repos');
    }
  }, []);

  const setLanguage = useCallback(
    (language: string | undefined) => {
      useTrendingStore.getState().setLanguage(language);
      fetchTrending(language);
    },
    [fetchTrending],
  );

  const setPeriod = useCallback(
    (period: TrendingPeriod) => {
      useTrendingStore.getState().setPeriod(period);
      fetchTrending(undefined, period);
    },
    [fetchTrending],
  );

  const selectRepo = useCallback((repo: TrendingRepo | null) => {
    useTrendingStore.getState().setSelectedRepo(repo);
  }, []);

  return {
    repos: store.repos,
    isLoading: store.isLoading,
    error: store.error,
    language: store.language,
    period: store.period,
    selectedRepo: store.selectedRepo,
    fetchTrending,
    setLanguage,
    setPeriod,
    selectRepo,
  };
}
