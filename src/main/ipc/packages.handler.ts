import { ipcMain } from 'electron';
import type { PackageIntelligenceService } from '../services/PackageIntelligenceService';

export function registerPackageHandlers(
  packageService: PackageIntelligenceService,
): void {
  ipcMain.handle('packages:search', async (_event, query: string, limit?: number) => {
    return packageService.search(query, limit);
  });

  ipcMain.handle('packages:get-details', async (_event, packageName: string) => {
    return packageService.getPackageDetails(packageName);
  });
}
