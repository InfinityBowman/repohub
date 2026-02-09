import { create } from 'zustand'
import type { PRInfo, GitHubStatus } from '@/types'

interface GitHubState {
  prsByRepo: Record<string, PRInfo | null>
  allUserPRs: PRInfo[]
  status: GitHubStatus | null
  lastFetch: number
  loading: boolean

  setPRsByRepo: (prs: Record<string, PRInfo | null>) => void
  setAllUserPRs: (prs: PRInfo[]) => void
  setStatus: (status: GitHubStatus) => void
  setLoading: (loading: boolean) => void
  setLastFetch: (ts: number) => void
  updateFromEvent: (data: { prsByRepo: Record<string, PRInfo | null>; allUserPRs: PRInfo[] }) => void
}

export const useGitHubStore = create<GitHubState>((set) => ({
  prsByRepo: {},
  allUserPRs: [],
  status: null,
  lastFetch: 0,
  loading: false,

  setPRsByRepo: (prsByRepo) => set({ prsByRepo }),
  setAllUserPRs: (allUserPRs) => set({ allUserPRs, lastFetch: Date.now() }),
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
  setLastFetch: (lastFetch) => set({ lastFetch }),
  updateFromEvent: (data) =>
    set({
      prsByRepo: data.prsByRepo,
      allUserPRs: data.allUserPRs,
      lastFetch: Date.now(),
    }),
}))
