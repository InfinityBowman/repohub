import { create } from 'zustand';
import type { TrendingRepo, TrendingPeriod } from '@/types';

interface TrendingState {
  repos: TrendingRepo[];
  isLoading: boolean;
  error: string | null;
  language: string | undefined;
  period: TrendingPeriod;
  selectedRepo: TrendingRepo | null;
  lastFetch: number;

  setRepos: (repos: TrendingRepo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLanguage: (language: string | undefined) => void;
  setPeriod: (period: TrendingPeriod) => void;
  setSelectedRepo: (repo: TrendingRepo | null) => void;
  setLastFetch: (timestamp: number) => void;
}

export const useTrendingStore = create<TrendingState>(set => ({
  repos: [],
  isLoading: false,
  error: null,
  language: undefined,
  period: 'week',
  selectedRepo: null,
  lastFetch: 0,

  setRepos: repos => set({ repos, isLoading: false }),
  setLoading: loading => set({ isLoading: loading }),
  setError: error => set({ error, isLoading: false }),
  setLanguage: language => set({ language }),
  setPeriod: period => set({ period }),
  setSelectedRepo: repo => set({ selectedRepo: repo }),
  setLastFetch: timestamp => set({ lastFetch: timestamp }),
}));
