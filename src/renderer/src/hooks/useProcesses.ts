import { useEffect, useCallback, useRef } from 'react';
import { useProcessStore } from '@/store/processStore';

// Track active listener count to handle StrictMode double-mount
let activeListeners = 0;
let cleanupFns: (() => void)[] = [];

export function useProcessListeners() {
  useEffect(() => {
    activeListeners++;

    if (activeListeners === 1) {
      window.electron.processes.getAll().then(processes => {
        useProcessStore.getState().setProcesses(processes);

        // Load saved logs for running processes
        for (const proc of processes) {
          window.electron.logs.get(proc.repoId).then(savedLog => {
            if (savedLog) {
              useProcessStore.getState().appendOutput(proc.repoId, savedLog);
            }
          });
        }
      });

      const unsubOutput = window.electron.on.processOutput(data => {
        useProcessStore.getState().appendOutput(data.repoId, data.data);
      });

      const unsubStatus = window.electron.on.processStatusChanged(info => {
        useProcessStore.getState().setProcessStatus(info);
      });

      cleanupFns = [unsubOutput, unsubStatus];
    }

    return () => {
      activeListeners--;
      if (activeListeners === 0) {
        for (const fn of cleanupFns) fn();
        cleanupFns = [];
      }
    };
  }, []);
}

export function useProcesses() {
  const store = useProcessStore();

  const start = useCallback(async (repoId: string, command?: string) => {
    return window.electron.processes.start(repoId, command);
  }, []);

  const stop = useCallback(async (repoId: string) => {
    return window.electron.processes.stop(repoId);
  }, []);

  const restart = useCallback(async (repoId: string) => {
    return window.electron.processes.restart(repoId);
  }, []);

  const resize = useCallback(async (repoId: string, cols: number, rows: number) => {
    return window.electron.processes.resize(repoId, cols, rows);
  }, []);

  const write = useCallback(async (repoId: string, data: string) => {
    return window.electron.processes.write(repoId, data);
  }, []);

  const openShell = useCallback(async (repoId: string) => {
    return window.electron.processes.openShell(repoId);
  }, []);

  const startPackage = useCallback(
    async (repoId: string, packageName: string, scriptName: string) => {
      return window.electron.processes.startPackage(repoId, packageName, scriptName);
    },
    [],
  );

  const stopPackage = useCallback(async (repoId: string, packageName: string) => {
    return window.electron.processes.stopPackage(repoId, packageName);
  }, []);

  const restartPackage = useCallback(
    async (repoId: string, packageName: string, scriptName: string) => {
      return window.electron.processes.restartPackage(repoId, packageName, scriptName);
    },
    [],
  );

  const resizePackage = useCallback(
    async (repoId: string, packageName: string, cols: number, rows: number) => {
      return window.electron.processes.resizePackage(repoId, packageName, cols, rows);
    },
    [],
  );

  return {
    processes: store.processes,
    terminalData: store.terminalData,
    start,
    stop,
    restart,
    resize,
    write,
    openShell,
    startPackage,
    stopPackage,
    restartPackage,
    resizePackage,
    clearOutput: store.clearOutput,
    isRunning: (repoId: string) => store.processes[repoId]?.status === 'running',
    isPackageRunning: (repoId: string, packageName: string) =>
      store.processes[`${repoId}:${packageName}`]?.status === 'running',
  };
}
