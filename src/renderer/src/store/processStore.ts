import { create } from 'zustand';
import type { ProcessInfo } from '@/types';

interface ProcessState {
  processes: Record<string, ProcessInfo>;
  terminalData: Record<string, string>;

  setProcessStatus: (info: ProcessInfo) => void;
  appendOutput: (repoId: string, data: string) => void;
  clearOutput: (repoId: string) => void;
  removeProcess: (repoId: string) => void;
  setProcesses: (processes: ProcessInfo[]) => void;
}

const MAX_TERMINAL_LENGTH = 100_000;

export const useProcessStore = create<ProcessState>(set => ({
  processes: {},
  terminalData: {},

  setProcessStatus: info =>
    set(state => ({
      processes: { ...state.processes, [info.repoId]: info },
    })),

  appendOutput: (repoId, data) =>
    set(state => {
      const existing = state.terminalData[repoId] || '';
      let updated = existing + data;
      // Trim if too long to prevent memory issues
      if (updated.length > MAX_TERMINAL_LENGTH) {
        updated = updated.slice(-MAX_TERMINAL_LENGTH);
      }
      return {
        terminalData: { ...state.terminalData, [repoId]: updated },
      };
    }),

  clearOutput: repoId =>
    set(state => ({
      terminalData: { ...state.terminalData, [repoId]: '' },
    })),

  removeProcess: repoId =>
    set(state => {
      const { [repoId]: _, ...rest } = state.processes;
      return { processes: rest };
    }),

  setProcesses: processes =>
    set(() => {
      const map: Record<string, ProcessInfo> = {};
      for (const p of processes) {
        map[p.repoId] = p;
      }
      return { processes: map };
    }),
}));
