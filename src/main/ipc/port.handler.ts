import { ipcMain, BrowserWindow } from 'electron';
import type { PortService } from '../services/PortService';

export function registerPortHandlers(portService: PortService): void {
  ipcMain.handle('port:scan', async () => {
    try {
      return await portService.scanPorts();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('port:start-monitoring', async () => {
    portService.startMonitoring();
    return { success: true };
  });

  ipcMain.handle('port:stop-monitoring', async () => {
    portService.stopMonitoring();
    return { success: true };
  });

  ipcMain.handle('port:kill-by-port', async (_event, port: number) => {
    try {
      await portService.killByPort(port);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Forward port changes to renderer
  portService.on('changed', ports => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('port:changed', ports);
    }
  });
}
