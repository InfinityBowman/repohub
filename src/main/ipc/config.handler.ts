import { ipcMain } from 'electron';
import type { ConfigService } from '../services/ConfigService';
import type { PortService } from '../services/PortService';
import type { AppConfig } from '../types/config.types';

export function registerConfigHandlers(
  configService: ConfigService,
  portService: PortService,
): void {
  ipcMain.handle('config:get', async () => {
    return configService.get();
  });

  ipcMain.handle('config:update', async (_event, updates: Partial<AppConfig>) => {
    const updated = configService.update(updates);

    // Propagate relevant config changes to services
    if (updates.portScanInterval !== undefined) {
      portService.updateInterval(updates.portScanInterval);
    }

    return updated;
  });

  ipcMain.handle('config:set-command-override', async (_event, repoId: string, command: string) => {
    configService.setCommandOverride(repoId, command);
    return { success: true };
  });

  ipcMain.handle('config:remove-command-override', async (_event, repoId: string) => {
    configService.removeCommandOverride(repoId);
    return { success: true };
  });
}
