import { create } from 'zustand';
import type { ScreenshotInfo } from '@/types';

interface ScreenshotsState {
  screenshots: ScreenshotInfo[];
  setScreenshots: (screenshots: ScreenshotInfo[]) => void;
  addScreenshot: (screenshot: ScreenshotInfo) => void;
}

export const useScreenshotsStore = create<ScreenshotsState>(set => ({
  screenshots: [],
  setScreenshots: screenshots => set({ screenshots }),
  addScreenshot: screenshot =>
    set(state => ({
      screenshots: [screenshot, ...state.screenshots].slice(0, 8),
    })),
}));
