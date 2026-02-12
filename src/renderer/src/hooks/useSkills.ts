import { useCallback, useEffect, useRef } from 'react';
import { useSkillsStore } from '@/store/skillsStore';

const FEATURED_QUERY = 'skills';

export function useSkills() {
  const store = useSkillsStore();
  const initialLoaded = useRef(false);

  // Load featured skills on first mount
  useEffect(() => {
    if (initialLoaded.current) return;
    const s = useSkillsStore.getState();
    if (s.directoryResults.length > 0) {
      initialLoaded.current = true;
      return;
    }
    initialLoaded.current = true;
    s.setDirectoryLoading(true);
    window.electron.skills.searchDirectory(FEATURED_QUERY, 100).then(results => {
      useSkillsStore.getState().setDirectoryResults(results);
    }).catch(() => {
      useSkillsStore.getState().setDirectoryLoading(false);
    });
  }, []);

  const searchDirectory = useCallback(async (query: string) => {
    if (!query.trim()) {
      // When clearing search, reload featured
      const s = useSkillsStore.getState();
      s.setDirectoryLoading(true);
      try {
        const results = await window.electron.skills.searchDirectory(FEATURED_QUERY, 100);
        useSkillsStore.getState().setDirectoryResults(results);
      } catch {
        useSkillsStore.getState().setDirectoryLoading(false);
      }
      return;
    }
    const s = useSkillsStore.getState();
    s.setDirectoryLoading(true);
    s.setError(null);
    try {
      const results = await window.electron.skills.searchDirectory(query, 100);
      useSkillsStore.getState().setDirectoryResults(results);
    } catch (err: any) {
      useSkillsStore.getState().setError(err.message || 'Search failed');
      useSkillsStore.getState().setDirectoryLoading(false);
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
      useSkillsStore.getState().setError(err.message || 'Failed to load skill details');
      useSkillsStore.getState().setLoadingDetail(false);
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

  // Sort results
  const sortedResults = store.sortByInstalls
    ? [...store.directoryResults].sort((a, b) => b.installs - a.installs)
    : store.directoryResults;

  return {
    selectedSkill: store.selectedSkill,
    loadingDetail: store.loadingDetail,
    installing: store.installing,
    error: store.error,
    directoryResults: sortedResults,
    directorySearchQuery: store.directorySearchQuery,
    directoryLoading: store.directoryLoading,
    sortByInstalls: store.sortByInstalls,
    setSelectedSkill: store.setSelectedSkill,
    searchDirectory,
    selectDirectorySkill,
    installDirectorySkill,
    setDirectorySearchQuery: store.setDirectorySearchQuery,
    setSortByInstalls: store.setSortByInstalls,
  };
}
