import { ipcMain, BrowserWindow } from 'electron'
import type { GitHubService } from '../services/GitHubService'

export function registerGitHubHandlers(
  githubService: GitHubService,
): void {
  ipcMain.handle('github:check-availability', async () => {
    return githubService.checkAvailability()
  })

  ipcMain.handle('github:get-pr-for-branch', async (_event, repoId: string) => {
    return githubService.getPRForBranch(repoId)
  })

  ipcMain.handle('github:get-all-user-prs', async () => {
    return githubService.fetchAllUserPRs()
  })

  ipcMain.handle('github:refresh', async () => {
    await githubService.refresh()
  })

  ipcMain.handle('github:create-pr', async (_event, repoId: string) => {
    return githubService.createPR(repoId)
  })

  githubService.on('github:changed', (data) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('github:changed', data)
    }
  })
}
