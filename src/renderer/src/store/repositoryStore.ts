import { create } from 'zustand';
import type { Repository } from '@/types';

interface RepositoryState {
  repositories: Repository[];
  loading: boolean;
  error: string | null;
  selectedRepoId: string | null;
  filterText: string;

  setRepositories: (repos: Repository[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectRepository: (id: string | null) => void;
  setFilter: (text: string) => void;
}

export const useRepositoryStore = create<RepositoryState>(set => ({
  repositories: [],
  loading: false,
  error: null,
  selectedRepoId: null,
  filterText: '',

  setRepositories: repositories => set({ repositories, error: null }),
  setLoading: loading => set({ loading }),
  setError: error => set({ error }),
  selectRepository: selectedRepoId => set({ selectedRepoId }),
  setFilter: filterText => set({ filterText }),
}));
