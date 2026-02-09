import { useEffect, useCallback } from 'react'
import { useGitHubStore } from '@/store/githubStore'

const COOLDOWN_MS = 2 * 60 * 1000

let githubListenerActive = false
let githubCleanup: (() => void) | null = null

export function useGitHubListeners() {
  useEffect(() => {
    if (githubListenerActive) return

    githubListenerActive = true

    // Check availability on mount
    window.electron.github.checkAvailability().then((status) => {
      useGitHubStore.getState().setStatus(status)

      if (status.available && status.authenticated) {
        // Initial fetch
        useGitHubStore.getState().setLoading(true)
        window.electron.github.getAllUserPRs().then((prs) => {
          useGitHubStore.getState().setAllUserPRs(prs)
          useGitHubStore.getState().setLoading(false)
        })
      }
    })

    const unsub = window.electron.on.githubChanged((data) => {
      useGitHubStore.getState().updateFromEvent(data)
    })

    githubCleanup = unsub

    // Refresh on window focus with cooldown
    const handleFocus = () => {
      const state = useGitHubStore.getState()
      if (!state.status?.available || !state.status?.authenticated) return
      if (Date.now() - state.lastFetch < COOLDOWN_MS) return

      window.electron.github.refresh()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      githubListenerActive = false
      window.removeEventListener('focus', handleFocus)
      if (githubCleanup) {
        githubCleanup()
        githubCleanup = null
      }
    }
  }, [])
}

export function useGitHub() {
  const store = useGitHubStore()

  const fetchPRForRepo = useCallback(async (repoId: string) => {
    const pr = await window.electron.github.getPRForBranch(repoId)
    useGitHubStore.getState().setPRsByRepo({
      ...useGitHubStore.getState().prsByRepo,
      [repoId]: pr,
    })
    return pr
  }, [])

  const fetchAllUserPRs = useCallback(async () => {
    store.setLoading(true)
    try {
      const prs = await window.electron.github.getAllUserPRs()
      store.setAllUserPRs(prs)
    } finally {
      store.setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    store.setLoading(true)
    try {
      await window.electron.github.refresh()
    } finally {
      store.setLoading(false)
    }
  }, [])

  const createPR = useCallback(async (repoId: string) => {
    return window.electron.github.createPR(repoId)
  }, [])

  return {
    prsByRepo: store.prsByRepo,
    allUserPRs: store.allUserPRs,
    status: store.status,
    loading: store.loading,
    lastFetch: store.lastFetch,
    fetchPRForRepo,
    fetchAllUserPRs,
    refresh,
    createPR,
    getPRForRepo: (repoId: string) => store.prsByRepo[repoId] ?? null,
    canRefresh: Date.now() - store.lastFetch >= COOLDOWN_MS,
  }
}
