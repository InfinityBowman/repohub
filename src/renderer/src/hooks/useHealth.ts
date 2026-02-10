import { useEffect, useCallback } from 'react';
import { useHealthStore } from '@/store/healthStore';

let healthListenerActive = false;
let healthCleanup: (() => void) | null = null;

export function useHealthListeners() {
  useEffect(() => {
    if (healthListenerActive) return;

    healthListenerActive = true;
    const unsub = window.electron.on.healthChanged(health => {
      useHealthStore.getState().setHealth(health);
    });

    healthCleanup = unsub;

    return () => {
      healthListenerActive = false;
      if (healthCleanup) {
        healthCleanup();
        healthCleanup = null;
      }
    };
  }, []);
}

export function useHealth() {
  const store = useHealthStore();

  const checkHealth = useCallback(async (repoId: string) => {
    store.setLoading(repoId, true);
    try {
      const health = await window.electron.health.check(repoId);
      store.setHealth(health);
    } catch {
      store.setLoading(repoId, false);
    }
  }, []);

  const checkAllHealth = useCallback(async (repoIds: string[]) => {
    for (const id of repoIds) {
      store.setLoading(id, true);
    }
    await window.electron.health.checkAll(repoIds);
  }, []);

  return {
    healthData: store.healthData,
    loadingRepos: store.loadingRepos,
    checkHealth,
    checkAllHealth,
    getHealthStatus: (repoId: string) => store.healthData[repoId] || null,
    isChecking: (repoId: string) => store.loadingRepos.has(repoId),
  };
}
