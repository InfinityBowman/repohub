import { ipcMain, BrowserWindow } from 'electron';
import type { DependencyHealthService } from '../services/DependencyHealthService';

export function registerHealthHandlers(healthService: DependencyHealthService): void {
  ipcMain.handle('health:check', async (_event, repoId: string) => {
    return healthService.check(repoId);
  });

  ipcMain.handle('health:check-all', async (_event, repoIds: string[]) => {
    healthService.checkAll(repoIds);
  });

  ipcMain.handle('health:get', async (_event, repoId: string) => {
    return healthService.get(repoId);
  });

  ipcMain.handle('health:clear', async (_event, repoId: string) => {
    healthService.clear(repoId);
  });

  healthService.on('health-changed', health => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('health:changed', health);
    }
  });
}
