import { ipcMain } from 'electron';
import type { PackageCloneService } from '../services/PackageCloneService';

export function registerPackageCloneHandlers(packageCloneService: PackageCloneService): void {
  ipcMain.handle('package-clone:clone', async (_event, packageName: string, repoUrl: string) => {
    return packageCloneService.clone(packageName, repoUrl);
  });

  ipcMain.handle('package-clone:status', async (_event, packageName: string) => {
    return packageCloneService.getCloneStatus(packageName);
  });

  ipcMain.handle(
    'package-clone:list-files',
    async (_event, packageName: string, relativePath: string) => {
      return packageCloneService.listFiles(packageName, relativePath);
    },
  );

  ipcMain.handle(
    'package-clone:read-file',
    async (_event, packageName: string, relativePath: string) => {
      return packageCloneService.readFile(packageName, relativePath);
    },
  );

  ipcMain.handle('package-clone:delete', async (_event, packageName: string) => {
    return packageCloneService.deleteClone(packageName);
  });
}
