import { create } from 'zustand';
import type { SkillSource, SkillSummary, SkillDetail } from '@/types';

interface SkillsState {
  sources: SkillSource[];
  activeSourceId: string | null;
  skills: Record<string, SkillSummary[]>;
  selectedSkill: SkillDetail | null;
  loading: boolean;
  loadingDetail: boolean;
  installing: boolean;
  error: string | null;
  searchQuery: string;

  setSources: (sources: SkillSource[]) => void;
  setActiveSource: (sourceId: string) => void;
  setSkills: (sourceId: string, skills: SkillSummary[]) => void;
  setSelectedSkill: (skill: SkillDetail | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadingDetail: (loading: boolean) => void;
  setInstalling: (installing: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useSkillsStore = create<SkillsState>(set => ({
  sources: [],
  activeSourceId: null,
  skills: {},
  selectedSkill: null,
  loading: false,
  loadingDetail: false,
  installing: false,
  error: null,
  searchQuery: '',

  setSources: sources => set({ sources }),
  setActiveSource: sourceId => set({ activeSourceId: sourceId, selectedSkill: null }),
  setSkills: (sourceId, skills) =>
    set(state => ({ skills: { ...state.skills, [sourceId]: skills }, loading: false })),
  setSelectedSkill: skill => set({ selectedSkill: skill, loadingDetail: false }),
  setLoading: loading => set({ loading }),
  setLoadingDetail: loadingDetail => set({ loadingDetail }),
  setInstalling: installing => set({ installing }),
  setError: error => set({ error }),
  setSearchQuery: query => set({ searchQuery: query }),
}));
