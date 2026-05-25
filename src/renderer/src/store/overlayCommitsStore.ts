import { create } from 'zustand';
import type { CommitInfo } from '@/types';

interface OverlayCommitsState {
  commits: CommitInfo[];
  loading: boolean;
  setCommits: (commits: CommitInfo[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useOverlayCommitsStore = create<OverlayCommitsState>(set => ({
  commits: [],
  loading: false,
  setCommits: commits => set({ commits, loading: false }),
  setLoading: loading => set({ loading }),
}));
