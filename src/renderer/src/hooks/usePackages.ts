import { useCallback } from 'react';
import { usePackageStore } from '@/store/packageStore';

export function usePackages() {
  const store = usePackageStore();

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      usePackageStore.getState().setSearchResults([]);
      return;
    }
    usePackageStore.getState().setSearching(true);
    usePackageStore.getState().setError(null);
    try {
      const results = await window.electron.packages.search(query);
      usePackageStore.getState().setSearchResults(results);
    } catch (err: any) {
      usePackageStore.getState().setError(err.message || 'Search failed');
      usePackageStore.getState().setSearching(false);
    }
  }, []);

  const loadDetails = useCallback(async (packageName: string) => {
    const s = usePackageStore.getState();
    if (s.packageDetails[packageName]) {
      s.setSelectedPackage(packageName);
      return;
    }
    s.setSelectedPackage(packageName);
    s.setLoadingDetail(packageName, true);
    s.setError(null);
    try {
      const detail = await window.electron.packages.getDetails(packageName);
      usePackageStore.getState().setPackageDetail(packageName, detail);
    } catch (err: any) {
      usePackageStore.getState().setLoadingDetail(packageName, false);
      usePackageStore.getState().setError(err.message || 'Failed to load package details');
    }
  }, []);

  // Clone lifecycle operations
  const clonePackage = useCallback(async (packageName: string, repoUrl: string) => {
    const s = usePackageStore.getState();
    s.setCloning(packageName, true);
    s.setError(null);
    try {
      const result = await window.electron.packageClone.clone(packageName, repoUrl);
      if (result.success) {
        const status = await window.electron.packageClone.getStatus(packageName);
        usePackageStore.getState().setCloneStatus(packageName, status);
      } else {
        usePackageStore.getState().setError(result.error || 'Clone failed');
      }
    } catch (err: any) {
      usePackageStore.getState().setError(err.message || 'Clone failed');
    } finally {
      usePackageStore.getState().setCloning(packageName, false);
    }
  }, []);

  const loadCloneStatus = useCallback(async (packageName: string) => {
    try {
      const status = await window.electron.packageClone.getStatus(packageName);
      usePackageStore.getState().setCloneStatus(packageName, status);
    } catch {
      // Not critical
    }
  }, []);

  const deleteClone = useCallback(async (packageName: string) => {
    try {
      await window.electron.packageClone.deleteClone(packageName);
      usePackageStore.getState().clearCloneState(packageName);
    } catch (err: any) {
      usePackageStore.getState().setError(err.message || 'Failed to delete clone');
    }
  }, []);

  return {
    searchQuery: store.searchQuery,
    searchResults: store.searchResults,
    isSearching: store.isSearching,
    selectedPackageName: store.selectedPackageName,
    selectedPackage:
      store.selectedPackageName ? store.packageDetails[store.selectedPackageName] || null : null,
    isLoadingDetail:
      store.selectedPackageName ? store.loadingDetails.has(store.selectedPackageName) : false,
    error: store.error,
    search,
    loadDetails,
    setSearchQuery: store.setSearchQuery,
    setSelectedPackage: store.setSelectedPackage,

    // Clone lifecycle
    cloneStatuses: store.cloneStatuses,
    cloningPackages: store.cloningPackages,
    clonePackage,
    loadCloneStatus,
    deleteClone,
  };
}
