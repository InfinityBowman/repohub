import { useEffect, useCallback } from 'react';
import { usePortStore } from '@/store/portStore';

export function usePorts() {
  const store = usePortStore();

  useEffect(() => {
    // Start monitoring
    window.electron.ports.startMonitoring().then(() => {
      store.setMonitoring(true);
    });

    const unsubscribe = window.electron.on.portsChanged(ports => {
      store.setPorts(ports);
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
    store.setPorts(ports);
  }, []);

  return {
    ports: store.ports,
    monitoring: store.monitoring,
    killByPort,
    refresh,
  };
}
