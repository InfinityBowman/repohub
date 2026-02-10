import { ipcMain } from 'electron'
import type { RepositoryService } from '../services/RepositoryService'
import type { GitBranchService } from '../services/GitBranchService'

export function registerGitHandlers(
  repositoryService: RepositoryService,
  gitBranchService: GitBranchService,
): void {
  ipcMain.handle('git:list-branches', async (_event, repoId: string) => {
    const repo = repositoryService.getById(repoId)
    if (!repo) return []
    try {
      return await gitBranchService.listBranches(repo.path)
    } catch (err: any) {
      return []
    }
  })

  ipcMain.handle(
    'git:delete-branches',
    async (_event, repoId: string, branches: string[]) => {
      const repo = repositoryService.getById(repoId)
      if (!repo) return { results: [] }
      try {
        return await gitBranchService.deleteBranches(repo.path, branches)
      } catch (err: any) {
        return { results: [] }
      }
    },
  )
}
