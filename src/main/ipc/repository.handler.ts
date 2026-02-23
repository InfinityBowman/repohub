import { ipcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { RepositoryService } from '../services/RepositoryService';

export function registerRepositoryHandlers(repositoryService: RepositoryService): void {
  ipcMain.handle('repo:scan', async () => {
    try {
      return await repositoryService.scan();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('repo:rescan', async () => {
    try {
      return await repositoryService.scan();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('repo:get-by-id', async (_event, id: string) => {
    return repositoryService.getById(id);
  });

  ipcMain.handle('shell:open-in-vscode', async (_event, dirPath: string) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      // Use VS Code CLI with -g flag to support file:line syntax
      const child = spawn('code', ['-g', dirPath], {
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => {
        // Fallback to macOS open if code CLI not found
        const fallback = spawn('open', ['-b', 'com.microsoft.VSCode', dirPath.split(':')[0]], {
          detached: true,
          stdio: 'ignore',
        });
        fallback.on('error', (fallbackErr) => {
          resolve({ success: false, error: fallbackErr.message });
        });
        fallback.unref();
        // If no error fires synchronously, assume success
        setTimeout(() => resolve({ success: true }), 200);
      });
      child.unref();
      // If no error fires, resolve as success
      setTimeout(() => resolve({ success: true }), 200);
    });
  });

  ipcMain.handle('shell:open-in-terminal', async (_event, dirPath: string) => {
    try {
      spawn('open', ['-a', 'Ghostty', '--args', '--working-directory=' + dirPath], {
        detached: true,
        stdio: 'ignore',
      }).unref();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('shell:open-url', async (_event, url: string) => {
    try {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('repo:read-file', async (_event, repoId: string, relativePath: string) => {
    const repo = repositoryService.getById(repoId);
    if (!repo) return { error: 'Not found' };
    const fullPath = path.resolve(repo.path, relativePath);
    // Safety: ensure resolved path is within repo directory
    if (!fullPath.startsWith(repo.path + path.sep) && fullPath !== repo.path) {
      return { error: 'Path outside repository' };
    }
    try {
      return await fs.promises.readFile(fullPath, 'utf-8');
    } catch {
      return { error: 'File not found' };
    }
  });

  // Forward repository changes to renderer
  repositoryService.on('changed', repos => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('repo:changed', repos);
    }
  });
}
