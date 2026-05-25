import { useEffect } from 'react';
import { useSystemMonitorListener } from '@/hooks/useSystemMonitor';
import { useScreenshotsListener } from '@/hooks/useScreenshots';
import { useOverlayCommitsListener } from '@/hooks/useOverlayCommits';
import { useGitHubListeners } from '@/hooks/useGitHub';
import { usePortStore } from '@/store/portStore';
import { OverlayShell } from './OverlayShell';
import { SystemGauges } from './SystemGauges';
import { OverlayPortsSection } from './OverlayPortsSection';
import { OverlayCommitsSection } from './OverlayCommitsSection';
import { OverlayScreenshots } from './OverlayScreenshots';
import { OverlayPRsSection } from './OverlayPRsSection';

function usePortsListener() {
  useEffect(() => {
    window.electron.ports.scan().then(ports => {
      usePortStore.getState().setPorts(ports);
    });
    return window.electron.on.portsChanged(ports => {
      usePortStore.getState().setPorts(ports);
    });
  }, []);
}

export function OverlayApp() {
  useSystemMonitorListener();
  useScreenshotsListener();
  useOverlayCommitsListener();
  usePortsListener();
  useGitHubListeners();

  return (
    <OverlayShell>
      <SystemGauges />
      <OverlayPortsSection />
      <OverlayCommitsSection />
      <OverlayPRsSection />
      <OverlayScreenshots />
    </OverlayShell>
  );
}
