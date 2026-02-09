import { create } from 'zustand'
import type { DependencyHealth } from '@/types'

interface HealthState {
  healthData: Record<string, DependencyHealth>
  loadingRepos: Set<string>

  setHealth: (health: DependencyHealth) => void
  setLoading: (repoId: string, loading: boolean) => void
  clear: (repoId: string) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  healthData: {},
  loadingRepos: new Set(),

  setHealth: (health) =>
    set((state) => ({
      healthData: { ...state.healthData, [health.repoId]: health },
      loadingRepos: new Set([...state.loadingRepos].filter((id) => id !== health.repoId)),
    })),

  setLoading: (repoId, loading) =>
    set((state) => {
      const next = new Set(state.loadingRepos)
      if (loading) next.add(repoId)
      else next.delete(repoId)
      return { loadingRepos: next }
    }),

  clear: (repoId) =>
    set((state) => {
      const { [repoId]: _, ...rest } = state.healthData
      return { healthData: rest }
    }),
}))
