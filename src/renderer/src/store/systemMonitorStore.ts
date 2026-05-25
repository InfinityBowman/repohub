import { create } from 'zustand';
import type { SystemSnapshot } from '@/types';

interface SystemMonitorState {
  cpuPercent: number;
  memUsedPercent: number;
  memUsedGb: number;
  memTotalGb: number;
  setSnapshot: (snapshot: SystemSnapshot) => void;
}

export const useSystemMonitorStore = create<SystemMonitorState>(set => ({
  cpuPercent: 0,
  memUsedPercent: 0,
  memUsedGb: 0,
  memTotalGb: 0,
  setSnapshot: snapshot => set(snapshot),
}));
