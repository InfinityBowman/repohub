import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import type { RepositoryService } from '../services/RepositoryService'

export function registerRepositoryHandlers(
  repositoryService: RepositoryService,
): void {
  ipcMain.handle('repo:scan', async () => {
    try {
      return await repositoryService.scan()
    } catch (err: any) {
      return { error: err.message }
    }
  })

  ipcMain.handle('repo:rescan', async () => {
    try {
      return await repositoryService.scan()
    } catch (err: any) {
      return { error: err.message }
    }
  })

  ipcMain.handle('repo:get-by-id', async (_event, id: string) => {
    return repositoryService.getById(id)
  })

  ipcMain.handle('shell:open-in-vscode', async (_event, dirPath: string) => {
    try {
      spawn('open', ['-b', 'com.microsoft.VSCode', dirPath], {
        detached: true,
        stdio: 'ignore',
      }).unref()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('shell:open-in-terminal', async (_event, dirPath: string) => {
    try {
      spawn('open', ['-a', 'Ghostty', '--args', '--working-directory=' + dirPath], {
        detached: true,
        stdio: 'ignore',
      }).unref()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('shell:open-url', async (_event, url: string) => {
    try {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Forward repository changes to renderer
  repositoryService.on('changed', (repos) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('repo:changed', repos)
    }
  })
}
