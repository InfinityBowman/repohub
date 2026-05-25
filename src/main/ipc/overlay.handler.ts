import { ipcMain, BrowserWindow, app } from 'electron';
import type { SystemMonitorService } from '../services/SystemMonitorService';
import type { ScreenshotWatcherService } from '../services/ScreenshotWatcherService';
import type { RecentCommitsService } from '../services/RecentCommitsService';

export function registerOverlayHandlers(
  systemMonitor: SystemMonitorService,
  screenshotWatcher: ScreenshotWatcherService,
  recentCommits: RecentCommitsService,
  getDashboardWindow: () => BrowserWindow | null,
  getOverlayWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('overlay:get-system-snapshot', () => {
    return systemMonitor.getLastSnapshot();
  });

  ipcMain.handle('overlay:get-recent-screenshots', () => {
    return screenshotWatcher.getRecent();
  });

  ipcMain.handle('overlay:get-recent-commits', async () => {
    return recentCommits.getRecent();
  });

  ipcMain.handle('overlay:refresh-commits', async () => {
    return recentCommits.refresh();
  });

  ipcMain.handle(
    'overlay:expand-to-dashboard',
    async (_event, { route }: { route: string }) => {
      const dashboard = getDashboardWindow();
      const overlay = getOverlayWindow();

      if (dashboard) {
        dashboard.show();
        dashboard.focus();
        dashboard.webContents.send('dashboard:navigate', route);
      }

      if (app.dock) {
        app.dock.show();
      }

      if (overlay) {
        overlay.hide();
      }
    },
  );

  ipcMain.handle('overlay:hide', () => {
    const overlay = getOverlayWindow();
    if (overlay) {
      overlay.hide();
    }
  });
}
