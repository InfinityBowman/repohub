import { create } from 'zustand';
import type { PackageSearchResult, PackageDetail, CloneStatus } from '@/types';

interface PackageState {
  searchQuery: string;
  searchResults: PackageSearchResult[];
  isSearching: boolean;
  selectedPackageName: string | null;
  packageDetails: Record<string, PackageDetail>;
  loadingDetails: Set<string>;
  error: string | null;

  // Clone state (lifecycle only — file browsing is handled by FileBrowser)
  cloneStatuses: Record<string, CloneStatus>;
  cloningPackages: Set<string>;

  setSearchQuery: (query: string) => void;
  setSearchResults: (results: PackageSearchResult[]) => void;
  setSearching: (loading: boolean) => void;
  setSelectedPackage: (name: string | null) => void;
  setPackageDetail: (name: string, detail: PackageDetail) => void;
  setLoadingDetail: (name: string, loading: boolean) => void;
  setError: (error: string | null) => void;

  // Clone setters
  setCloneStatus: (name: string, status: CloneStatus) => void;
  setCloning: (name: string, cloning: boolean) => void;
  clearCloneState: (packageName: string) => void;
}

export const usePackageStore = create<PackageState>(set => ({
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  selectedPackageName: null,
  packageDetails: {},
  loadingDetails: new Set(),
  error: null,

  // Clone state
  cloneStatuses: {},
  cloningPackages: new Set(),

  setSearchQuery: query => set({ searchQuery: query }),

  setSearchResults: results => set({ searchResults: results, isSearching: false }),

  setSearching: loading => set({ isSearching: loading }),

  setSelectedPackage: name => set({ selectedPackageName: name }),

  setPackageDetail: (name, detail) =>
    set(state => ({
      packageDetails: { ...state.packageDetails, [name]: detail },
      loadingDetails: new Set([...state.loadingDetails].filter(n => n !== name)),
    })),

  setLoadingDetail: (name, loading) =>
    set(state => {
      const next = new Set(state.loadingDetails);
      if (loading) next.add(name);
      else next.delete(name);
      return { loadingDetails: next };
    }),

  setError: error => set({ error }),

  // Clone setters
  setCloneStatus: (name, status) =>
    set(state => ({
      cloneStatuses: { ...state.cloneStatuses, [name]: status },
    })),

  setCloning: (name, cloning) =>
    set(state => {
      const next = new Set(state.cloningPackages);
      if (cloning) next.add(name);
      else next.delete(name);
      return { cloningPackages: next };
    }),

  clearCloneState: packageName =>
    set(state => {
      const cloneStatuses = { ...state.cloneStatuses };
      delete cloneStatuses[packageName];
      return { cloneStatuses };
    }),
}));
