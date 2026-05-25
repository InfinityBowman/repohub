import { useEffect } from 'react';
import { useScreenshotsStore } from '@/store/screenshotsStore';

export function useScreenshotsListener(): void {
  useEffect(() => {
    window.electron.overlay.getRecentScreenshots().then(screenshots => {
      useScreenshotsStore.getState().setScreenshots(screenshots);
    });

    return window.electron.on.screenshotAdded(info => {
      useScreenshotsStore.getState().addScreenshot(info);
    });
  }, []);
}
