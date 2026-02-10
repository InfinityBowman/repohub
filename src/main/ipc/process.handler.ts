import { ipcMain, BrowserWindow } from 'electron';
import type { ProcessService } from '../services/ProcessService';

export function registerProcessHandlers(processService: ProcessService): void {
  ipcMain.handle('process:start', async (_event, repoId: string, command?: string) => {
    return processService.start(repoId, command);
  });

  ipcMain.handle('process:stop', async (_event, repoId: string) => {
    await processService.stop(repoId);
    return { success: true };
  });

  ipcMain.handle('process:restart', async (_event, repoId: string) => {
    return processService.restart(repoId);
  });

  ipcMain.handle('process:get-all', async () => {
    return processService.getAll();
  });

  ipcMain.handle('process:resize', async (_event, repoId: string, cols: number, rows: number) => {
    processService.resize(repoId, cols, rows);
  });

  ipcMain.handle(
    'process:start-package',
    async (_event, repoId: string, packageName: string, scriptName: string) => {
      return processService.startPackage(repoId, packageName, scriptName);
    },
  );

  ipcMain.handle('process:stop-package', async (_event, repoId: string, packageName: string) => {
    await processService.stopPackage(repoId, packageName);
    return { success: true };
  });

  ipcMain.handle(
    'process:restart-package',
    async (_event, repoId: string, packageName: string, scriptName: string) => {
      return processService.restartPackage(repoId, packageName, scriptName);
    },
  );

  ipcMain.handle(
    'process:resize-package',
    async (_event, repoId: string, packageName: string, cols: number, rows: number) => {
      processService.resizePackage(repoId, packageName, cols, rows);
    },
  );

  // Forward process events to renderer
  processService.on('output', data => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('process:output', data);
    }
  });

  processService.on('status-changed', info => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('process:status-changed', info);
    }
  });
}
