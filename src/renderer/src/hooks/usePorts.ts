import { useEffect, useCallback } from 'react';
import { usePortStore } from '@/store/portStore';

// Track active listener count to handle StrictMode double-mount
let activeListeners = 0;
let cleanupFns: (() => void)[] = [];

export function usePorts() {
  const store = usePortStore();

  useEffect(() => {
    activeListeners++;

    if (activeListeners === 1) {
      const unsubPorts = window.electron.on.portsChanged(ports => {
        usePortStore.getState().setPorts(ports);
      });

      const unsubError = window.electron.on.portScanError((message: string) => {
        usePortStore.getState().setError(message);
      });

      cleanupFns = [unsubPorts, unsubError];
    }

    return () => {
      activeListeners--;
      if (activeListeners === 0) {
        for (const fn of cleanupFns) fn();
        cleanupFns = [];
      }
    };
  }, []);

  const killByPort = useCallback(async (port: number) => {
    return window.electron.ports.killByPort(port);
  }, []);

  const refresh = useCallback(async () => {
    const ports = await window.electron.ports.scan();
    usePortStore.getState().setPorts(ports);
  }, []);

  return {
    ports: store.ports,
    error: store.error,
    firstSeen: store.firstSeen,
    killByPort,
    refresh,
  };
}
