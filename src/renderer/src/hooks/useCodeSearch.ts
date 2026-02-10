import { useEffect, useCallback } from 'react';
import { useCodeSearchStore } from '@/store/codeSearchStore';
import type { SearchOptions } from '@/types';

// Module-level listener count to handle StrictMode double-mount
let activeListeners = 0;
let cleanupFns: (() => void)[] = [];

function getStore() {
  return useCodeSearchStore.getState();
}

function handleError(error: any, defaultMsg: string) {
  getStore().setError(error.message || defaultMsg);
}

export function useCodeSearchListeners() {
  useEffect(() => {
    activeListeners++;

    if (activeListeners === 1) {
      // Fetch initial status
      window.electron.search.getStatus().then(status => {
        getStore().setStatus(status);
      });

      const unsubStatus = window.electron.on.searchStatusChanged(status => {
        getStore().setStatus(status);
      });

      const unsubProgress = window.electron.on.searchModelProgress(progress => {
        getStore().setModelProgress(progress);
      });

      cleanupFns = [unsubStatus, unsubProgress];
    }

    return () => {
      activeListeners--;
      if (activeListeners === 0) {
        for (const fn of cleanupFns) fn();
        cleanupFns = [];
      }
    };
  }, []);
}

export function useCodeSearch() {
  const store = useCodeSearchStore();

  const search = useCallback(async (options: SearchOptions) => {
    const s = getStore();
    s.setLoading(true);
    s.setError(null);
    try {
      const results = await window.electron.search.query(options);
      getStore().setResults(results);
    } catch (error: any) {
      handleError(error, 'Search failed');
    } finally {
      getStore().setLoading(false);
    }
  }, []);

  const startIndexing = useCallback(async () => {
    try {
      await window.electron.search.startIndexing();
    } catch (error: any) {
      handleError(error, 'Indexing failed');
    }
  }, []);

  const ensureModel = useCallback(async () => {
    try {
      await window.electron.search.ensureModel();
    } catch (error: any) {
      handleError(error, 'Model download failed');
    }
  }, []);

  const getStatus = useCallback(async () => {
    const status = await window.electron.search.getStatus();
    getStore().setStatus(status);
    return status;
  }, []);

  const reindex = useCallback(async () => {
    try {
      await window.electron.search.reindex();
    } catch (error: any) {
      handleError(error, 'Reindex failed');
    }
  }, []);

  return {
    results: store.results,
    status: store.status,
    loading: store.loading,
    error: store.error,
    modelProgress: store.modelProgress,
    search,
    startIndexing,
    ensureModel,
    getStatus,
    reindex,
  };
}
