import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './window'

// macOS packaged apps inherit a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin).
// Augment with common tool directories so gh, git, pnpm, npm, node etc. are found.
// Uses only static paths to avoid blocking the main thread at startup.
const extraPaths = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
]
const currentPath = process.env.PATH || ''
const currentParts = new Set(currentPath.split(':'))
const newParts = extraPaths.filter((p) => !currentParts.has(p))
if (newParts.length > 0) {
  process.env.PATH = [...newParts, currentPath].join(':')
}

import { registerAllHandlers } from './ipc'
import { ConfigService } from './services/ConfigService'
import { RepositoryService } from './services/RepositoryService'
import { ProcessService } from './services/ProcessService'
import { PortService } from './services/PortService'
import { LogService } from './services/LogService'
import { DependencyHealthService } from './services/DependencyHealthService'
import { GitHubService } from './services/GitHubService'
import { GitBranchService } from './services/GitBranchService'

// Initialize services
const configService = new ConfigService()
const repositoryService = new RepositoryService(configService)
const processService = new ProcessService(repositoryService, configService)
const portService = new PortService(
  processService,
  configService.get().portScanInterval,
)
const logService = new LogService()
const healthService = new DependencyHealthService(repositoryService)
const githubService = new GitHubService(repositoryService)
const gitBranchService = new GitBranchService()

app.whenReady().then(() => {
  // Register IPC handlers
  registerAllHandlers({
    repositoryService,
    processService,
    portService,
    configService,
    healthService,
    githubService,
    gitBranchService,
  })

  // Create window
  const mainWindow = createMainWindow()

  // Refresh git info and GitHub PRs when window regains focus
  mainWindow.on('focus', () => {
    repositoryService.refreshGitInfo().then((repos) => {
      mainWindow.webContents.send('repo:changed', repos)
    })
    githubService.refreshIfNeeded()
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
