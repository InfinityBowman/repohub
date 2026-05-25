import { useEffect } from 'react';
import { useOverlayCommitsStore } from '@/store/overlayCommitsStore';

export function useOverlayCommitsListener(): void {
  useEffect(() => {
    let cancelled = false;

    useOverlayCommitsStore.getState().setLoading(true);
    window.electron.overlay.getRecentCommits().then(commits => {
      if (!cancelled) useOverlayCommitsStore.getState().setCommits(commits);
    });

    const interval = setInterval(() => {
      window.electron.overlay.refreshCommits().then(commits => {
        if (!cancelled) useOverlayCommitsStore.getState().setCommits(commits);
      });
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
