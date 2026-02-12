import { useEffect, useCallback } from 'react';
import { usePortStore } from '@/store/portStore';

export function usePorts() {
  const store = usePortStore();

  useEffect(() => {
    const unsubPorts = window.electron.on.portsChanged(ports => {
      usePortStore.getState().setPorts(ports);
    });

    const unsubError = window.electron.on.portScanError((message: string) => {
      usePortStore.getState().setError(message);
    });

    return () => {
      unsubPorts();
      unsubError();
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
