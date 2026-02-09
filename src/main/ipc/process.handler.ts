import { ipcMain, BrowserWindow } from 'electron'
import type { ProcessService } from '../services/ProcessService'

export function registerProcessHandlers(
  processService: ProcessService,
): void {
  ipcMain.handle(
    'process:start',
    async (_event, repoId: string, command?: string) => {
      return processService.start(repoId, command)
    },
  )

  ipcMain.handle('process:stop', async (_event, repoId: string) => {
    await processService.stop(repoId)
    return { success: true }
  })

  ipcMain.handle('process:restart', async (_event, repoId: string) => {
    return processService.restart(repoId)
  })

  ipcMain.handle('process:get-all', async () => {
    return processService.getAll()
  })

  ipcMain.handle(
    'process:resize',
    async (_event, repoId: string, cols: number, rows: number) => {
      processService.resize(repoId, cols, rows)
    },
  )

  // Forward process events to renderer
  processService.on('output', (data) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('process:output', data)
    }
  })

  processService.on('status-changed', (info) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('process:status-changed', info)
    }
  })
}
