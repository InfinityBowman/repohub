import { useCallback, useEffect, useRef } from 'react';
import { useSkillsStore } from '@/store/skillsStore';

const FEATURED_QUERY = 'skills';

export function useSkills() {
  const store = useSkillsStore();
  const currentSearchId = useRef(0);

  // Load featured skills on first mount
  useEffect(() => {
    const s = useSkillsStore.getState();
    if (s.directoryResults.length === 0 && !s.directoryLoading) {
      s.setDirectoryLoading(true);
      window.electron.skills
        .searchDirectory(FEATURED_QUERY, 100)
        .then(results => {
          useSkillsStore.getState().setDirectoryResults(results);
        })
        .catch(() => {
          useSkillsStore.getState().setDirectoryLoading(false);
        });
    }
  }, []);

  const searchDirectory = useCallback(async (query: string) => {
    const searchId = ++currentSearchId.current;

    if (!query.trim()) {
      // When clearing search, reload featured
      useSkillsStore.getState().setDirectoryLoading(true);
      try {
        const results = await window.electron.skills.searchDirectory(FEATURED_QUERY, 100);
        if (currentSearchId.current === searchId) {
          useSkillsStore.getState().setDirectoryResults(results);
        }
      } catch {
        if (currentSearchId.current === searchId) {
          useSkillsStore.getState().setDirectoryLoading(false);
        }
      }
      return;
    }

    const s = useSkillsStore.getState();
    s.setDirectoryLoading(true);
    s.setError(null);
    try {
      const results = await window.electron.skills.searchDirectory(query, 100);
      if (currentSearchId.current === searchId) {
        useSkillsStore.getState().setDirectoryResults(results);
      }
    } catch (err: any) {
      if (currentSearchId.current === searchId) {
        const state = useSkillsStore.getState();
        state.setError(err.message || 'Search failed');
        state.setDirectoryLoading(false);
      }
    }
  }, []);

  const selectDirectorySkill = useCallback(async (source: string, skillId: string) => {
    const s = useSkillsStore.getState();
    s.setLoadingDetail(true);
    s.setError(null);
    try {
      const detail = await window.electron.skills.getDirectoryDetail(source, skillId);
      useSkillsStore.getState().setSelectedSkill(detail);
    } catch (err: any) {
      const state = useSkillsStore.getState();
      state.setError(err.message || 'Failed to load skill details');
      state.setLoadingDetail(false);
    }
  }, []);

  const installDirectorySkill = useCallback(async (source: string, skillId: string) => {
    const targetDir = await window.electron.skills.pickDirectory();
    if (!targetDir) return;

    const s = useSkillsStore.getState();
    s.setInstalling(true);
    s.setError(null);
    try {
      const result = await window.electron.skills.installDirectory(source, skillId, targetDir);
      if (!result.success) {
        useSkillsStore.getState().setError(result.error || 'Install failed');
      }
    } catch (err: any) {
      useSkillsStore.getState().setError(err.message || 'Install failed');
    } finally {
      useSkillsStore.getState().setInstalling(false);
    }
  }, []);

  return {
    selectedSkill: store.selectedSkill,
    loadingDetail: store.loadingDetail,
    installing: store.installing,
    error: store.error,
    directoryResults: store.directoryResults,
    directorySearchQuery: store.directorySearchQuery,
    directoryLoading: store.directoryLoading,
    setSelectedSkill: store.setSelectedSkill,
    searchDirectory,
    selectDirectorySkill,
    installDirectorySkill,
    setDirectorySearchQuery: store.setDirectorySearchQuery,
  };
}
