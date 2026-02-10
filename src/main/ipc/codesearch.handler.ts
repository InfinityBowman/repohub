import { ipcMain, BrowserWindow } from 'electron'
import type { CodeSearchService } from '../services/CodeSearchService'
import type { SearchOptions } from '../types/codesearch.types'

export function registerCodeSearchHandlers(
  codeSearchService: CodeSearchService,
): void {
  ipcMain.handle('search:query', async (_event, options: SearchOptions) => {
    return codeSearchService.search(options)
  })

  ipcMain.handle('search:start-indexing', async (_event, dirs?: string[]) => {
    // Run indexing in the background — don't await, but catch errors
    codeSearchService.startIndexing(dirs).catch((error) => {
      console.error('Code search indexing failed:', error)
    })
    return { success: true }
  })

  ipcMain.handle('search:get-status', async () => {
    return codeSearchService.getStatus()
  })

  ipcMain.handle('search:ensure-model', async () => {
    await codeSearchService.ensureModel()
    return { success: true }
  })

  ipcMain.handle('search:reindex', async () => {
    codeSearchService.startIndexing().catch((error) => {
      console.error('Code search reindex failed:', error)
    })
    return { success: true }
  })

  // Forward service events to renderer
  codeSearchService.on('status-changed', (status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('search:status-changed', status)
    }
  })

  codeSearchService.on('model-progress', (progress) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('search:model-progress', progress)
    }
  })
}
