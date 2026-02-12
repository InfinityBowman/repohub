import { create } from 'zustand';
import type { SkillDetail, DirectorySkill } from '@/types';

interface SkillsState {
  selectedSkill: SkillDetail | null;
  loadingDetail: boolean;
  installing: boolean;
  error: string | null;

  // Directory search state
  directoryResults: DirectorySkill[];
  directorySearchQuery: string;
  directoryLoading: boolean;

  setSelectedSkill: (skill: SkillDetail | null) => void;
  setLoadingDetail: (loading: boolean) => void;
  setInstalling: (installing: boolean) => void;
  setError: (error: string | null) => void;
  setDirectoryResults: (skills: DirectorySkill[]) => void;
  setDirectorySearchQuery: (query: string) => void;
  setDirectoryLoading: (loading: boolean) => void;
}

export const useSkillsStore = create<SkillsState>(set => ({
  selectedSkill: null,
  loadingDetail: false,
  installing: false,
  error: null,
  directoryResults: [],
  directorySearchQuery: '',
  directoryLoading: false,

  setSelectedSkill: skill => set({ selectedSkill: skill, loadingDetail: false }),
  setLoadingDetail: loadingDetail => set({ loadingDetail }),
  setInstalling: installing => set({ installing }),
  setError: error => set({ error }),
  setDirectoryResults: skills => set({ directoryResults: skills, directoryLoading: false }),
  setDirectorySearchQuery: query => set({ directorySearchQuery: query }),
  setDirectoryLoading: loading => set({ directoryLoading: loading }),
}));
