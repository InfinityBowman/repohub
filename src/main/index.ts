import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './window'
import { registerAllHandlers } from './ipc'
import { ConfigService } from './services/ConfigService'
import { RepositoryService } from './services/RepositoryService'
import { ProcessService } from './services/ProcessService'
import { PortService } from './services/PortService'
import { LogService } from './services/LogService'

// Initialize services
const configService = new ConfigService()
const repositoryService = new RepositoryService(configService)
const processService = new ProcessService(repositoryService, configService)
const portService = new PortService(
  processService,
  configService.get().portScanInterval,
)
const logService = new LogService()

app.whenReady().then(() => {
  // Register IPC handlers
  registerAllHandlers({
    repositoryService,
    processService,
    portService,
    configService,
  })

  // Create window
  const mainWindow = createMainWindow()

  // Refresh git info when window regains focus
  mainWindow.on('focus', () => {
    const repos = repositoryService.refreshGitInfo()
    mainWindow.webContents.send('repo:changed', repos)
  })

  // Persist process output to log files
  processService.on('output', (data: { repoId: string; data: string }) => {
    logService.append(data.repoId, data.data)
  })

  // IPC handlers for log persistence
  ipcMain.handle('logs:get', async (_event, repoId: string) => {
    return logService.get(repoId)
  })

  ipcMain.handle('logs:clear', async (_event, repoId: string) => {
    logService.clear(repoId)
    return { success: true }
  })

  // Initial scan
  repositoryService.scan()
  repositoryService.startWatching()

  // Start port monitoring if configured
  if (configService.get().autoStartMonitoring) {
    portService.startMonitoring()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  processService.stopAll()
  portService.stopMonitoring()
  repositoryService.stopWatching()
})
