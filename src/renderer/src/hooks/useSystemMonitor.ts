import { useEffect } from 'react';
import { useSystemMonitorStore } from '@/store/systemMonitorStore';

export function useSystemMonitorListener(): void {
  useEffect(() => {
    window.electron.overlay.getSystemSnapshot().then(snapshot => {
      useSystemMonitorStore.getState().setSnapshot(snapshot);
    });

    return window.electron.on.systemSnapshot(snapshot => {
      useSystemMonitorStore.getState().setSnapshot(snapshot);
    });
  }, []);
}
