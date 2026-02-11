import { useEffect, useCallback } from 'react';
import { usePortStore } from '@/store/portStore';

export function usePorts() {
  const store = usePortStore();

  useEffect(() => {
    // Start monitoring
    window.electron.ports.startMonitoring().then(() => {
      usePortStore.getState().setMonitoring(true);
    });

    const unsubscribe = window.electron.on.portsChanged(ports => {
      usePortStore.getState().setPorts(ports);
    });

    return () => {
      unsubscribe();
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
    monitoring: store.monitoring,
    killByPort,
    refresh,
  };
}
