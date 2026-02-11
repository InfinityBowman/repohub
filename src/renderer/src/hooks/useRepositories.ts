import { useEffect, useCallback } from 'react';
import { useRepositoryStore } from '@/store/repositoryStore';

export function useRepositories() {
  const store = useRepositoryStore();

  const scan = useCallback(async () => {
    useRepositoryStore.getState().setLoading(true);
    try {
      const repos = await window.electron.repositories.scan();
      useRepositoryStore.getState().setRepositories(repos);
    } catch (err: any) {
      useRepositoryStore.getState().setError(err.message);
    } finally {
      useRepositoryStore.getState().setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();

    const unsubscribe = window.electron.on.repositoriesChanged(repos => {
      useRepositoryStore.getState().setRepositories(repos);
    });

    return unsubscribe;
  }, [scan]);

  const filterLower = store.filterText.toLowerCase();
  const filtered = store.repositories.filter(
    repo =>
      repo.name.toLowerCase().includes(filterLower) ||
      repo.projectType.toLowerCase().includes(filterLower) ||
      repo.path.toLowerCase().includes(filterLower) ||
      (repo.gitBranch && repo.gitBranch.toLowerCase().includes(filterLower)),
  );

  return {
    repositories: filtered,
    allRepositories: store.repositories,
    loading: store.loading,
    error: store.error,
    selectedRepoId: store.selectedRepoId,
    filterText: store.filterText,
    scan,
    selectRepository: store.selectRepository,
    setFilter: store.setFilter,
  };
}
