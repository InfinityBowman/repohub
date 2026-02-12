import { useCallback, useEffect, useRef } from 'react';
import { useSkillsStore } from '@/store/skillsStore';

export function useSkills() {
  const store = useSkillsStore();
  const sourcesLoaded = useRef(false);

  // Load sources on first use
  useEffect(() => {
    if (sourcesLoaded.current) return;
    sourcesLoaded.current = true;
    window.electron.skills.getSources().then(sources => {
      useSkillsStore.getState().setSources(sources);
      // Auto-select first source
      if (sources.length > 0 && !useSkillsStore.getState().activeSourceId) {
        useSkillsStore.getState().setActiveSource(sources[0].id);
      }
    });
  }, []);

  const loadSkills = useCallback(async (sourceId: string) => {
    const s = useSkillsStore.getState();
    // Use cache if available
    if (s.skills[sourceId]) return;

    s.setLoading(true);
    s.setError(null);
    try {
      const skills = await window.electron.skills.list(sourceId);
      useSkillsStore.getState().setSkills(sourceId, skills);
    } catch (err: any) {
      useSkillsStore.getState().setError(err.message || 'Failed to load skills');
      useSkillsStore.getState().setLoading(false);
    }
  }, []);

  const selectSource = useCallback(
    (sourceId: string) => {
      useSkillsStore.getState().setActiveSource(sourceId);
      loadSkills(sourceId);
    },
    [loadSkills],
  );

  const selectSkill = useCallback(async (sourceId: string, skillPath: string) => {
    const s = useSkillsStore.getState();
    s.setLoadingDetail(true);
    s.setError(null);
    try {
      const detail = await window.electron.skills.getDetail(sourceId, skillPath);
      useSkillsStore.getState().setSelectedSkill(detail);
    } catch (err: any) {
      useSkillsStore.getState().setError(err.message || 'Failed to load skill details');
      useSkillsStore.getState().setLoadingDetail(false);
    }
  }, []);

  const installSkill = useCallback(async (sourceId: string, skillPath: string) => {
    const targetDir = await window.electron.skills.pickDirectory();
    if (!targetDir) return;

    const s = useSkillsStore.getState();
    s.setInstalling(true);
    s.setError(null);
    try {
      const result = await window.electron.skills.install(sourceId, skillPath, targetDir);
      if (!result.success) {
        useSkillsStore.getState().setError(result.error || 'Install failed');
      }
    } catch (err: any) {
      useSkillsStore.getState().setError(err.message || 'Install failed');
    } finally {
      useSkillsStore.getState().setInstalling(false);
    }
  }, []);

  // Auto-load skills when source changes
  useEffect(() => {
    if (store.activeSourceId) {
      loadSkills(store.activeSourceId);
    }
  }, [store.activeSourceId, loadSkills]);

  // Filter skills by search query
  const currentSkills = store.activeSourceId ? store.skills[store.activeSourceId] || [] : [];
  const filteredSkills =
    store.searchQuery.trim() ?
      currentSkills.filter(s => {
        const q = store.searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some(t => t.toLowerCase().includes(q))
        );
      })
    : currentSkills;

  return {
    sources: store.sources,
    activeSourceId: store.activeSourceId,
    skills: filteredSkills,
    selectedSkill: store.selectedSkill,
    loading: store.loading,
    loadingDetail: store.loadingDetail,
    installing: store.installing,
    error: store.error,
    searchQuery: store.searchQuery,
    selectSource,
    selectSkill,
    installSkill,
    setSearchQuery: store.setSearchQuery,
    setSelectedSkill: store.setSelectedSkill,
  };
}
