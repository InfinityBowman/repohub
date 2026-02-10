import { create } from 'zustand';
import type { SearchResult, IndexStatus, ModelProgress } from '@/types';

interface CodeSearchState {
  results: SearchResult[];
  status: IndexStatus | null;
  loading: boolean;
  error: string | null;
  modelProgress: ModelProgress | null;

  setResults: (results: SearchResult[]) => void;
  setStatus: (status: IndexStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setModelProgress: (progress: ModelProgress | null) => void;
}

export const useCodeSearchStore = create<CodeSearchState>(set => ({
  results: [],
  status: null,
  loading: false,
  error: null,
  modelProgress: null,

  setResults: results => set({ results }),
  setStatus: status => set({ status }),
  setLoading: loading => set({ loading }),
  setError: error => set({ error }),
  setModelProgress: progress => set({ modelProgress: progress }),
}));
