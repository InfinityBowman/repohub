import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { EventEmitter } from 'events'
import { watch } from 'chokidar'
import { ProjectDetector } from './ProjectDetector'
import { WorkspaceDetector } from './WorkspaceDetector'
import { ConfigService } from './ConfigService'
import type { Repository } from '../types/repository.types'

const execAsync = promisify(exec)

export class RepositoryService extends EventEmitter {
  private detector = new ProjectDetector()
  private workspaceDetector = new WorkspaceDetector()
  private configService: ConfigService
  private watcher: ReturnType<typeof watch> | null = null
  private repositories: Repository[] = []

  constructor(configService: ConfigService) {
    super()
    this.configService = configService
  }

  async scan(): Promise<Repository[]> {
    const config = this.configService.get()
    const scanDir = config.scanDirectory

    if (!fs.existsSync(scanDir)) {
      this.repositories = []
      return []
    }

    const repos: Repository[] = []
    this.scanDirectory(scanDir, scanDir, config.ignorePatterns, repos, 0)

    // Fetch git info for all repos in parallel (non-blocking)
    await Promise.all(
      repos.map(async (repo) => {
        const git = await this.getGitInfo(repo.path)
        repo.gitBranch = git.gitBranch
        repo.gitDirty = git.gitDirty
      }),
    )

    repos.sort((a, b) => b.lastModified - a.lastModified)
    this.repositories = repos
    return repos
  }

  private scanDirectory(
    dir: string,
    scanRoot: string,
    ignorePatterns: string[],
    repos: Repository[],
    depth: number,
  ): void {
    if (depth > 5) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.')) continue

      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(scanRoot, fullPath)

      if (this.isIgnored(entry.name, relativePath, ignorePatterns)) continue

      const detection = this.detector.detect(fullPath)

      if (detection.projectType !== 'unknown') {
        const stat = fs.statSync(fullPath)
        const repo: Repository = {
          id: crypto.createHash('md5').update(fullPath).digest('hex').slice(0, 12),
          name: relativePath,
          path: fullPath,
          projectType: detection.projectType,
          defaultCommand: detection.defaultCommand,
          lastModified: stat.mtimeMs,
        }

        if (detection.projectType === 'monorepo') {
          repo.workspace = this.workspaceDetector.detectWorkspace(fullPath)
        }

        repos.push(repo)
      } else {
        // Not a recognized project — recurse to find nested projects
        this.scanDirectory(fullPath, scanRoot, ignorePatterns, repos, depth + 1)
      }
    }
  }

  async refreshGitInfo(): Promise<Repository[]> {
    await Promise.all(
      this.repositories.map(async (repo) => {
        const git = await this.getGitInfo(repo.path)
        repo.gitBranch = git.gitBranch
        repo.gitDirty = git.gitDirty
      }),
    )
    return this.repositories
  }

  getById(id: string): Repository | null {
    return this.repositories.find((r) => r.id === id) || null
  }

  getAll(): Repository[] {
    return this.repositories
  }

  startWatching(): void {
    const config = this.configService.get()
    const scanDir = config.scanDirectory

    if (this.watcher) {
      this.watcher.close()
    }

    // Watch top-level only; the recursive scan handles finding nested projects
    this.watcher = watch(scanDir, {
      depth: 1,
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../,
    })

    this.watcher.on('addDir', () => {
      this.scan().then((repos) => this.emit('changed', repos))
    })

    this.watcher.on('unlinkDir', () => {
      this.scan().then((repos) => this.emit('changed', repos))
    })
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private async getGitInfo(dirPath: string): Promise<{ gitBranch?: string; gitDirty?: boolean }> {
    try {
      if (!fs.existsSync(path.join(dirPath, '.git'))) return {}
      const [branchResult, statusResult] = await Promise.all([
        execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: dirPath,
          timeout: 3000,
        }),
        execAsync('git status --porcelain', {
          cwd: dirPath,
          timeout: 3000,
        }),
      ])
      return {
        gitBranch: branchResult.stdout.trim(),
        gitDirty: statusResult.stdout.trim().length > 0,
      }
    } catch {
      return {}
    }
  }

  private isIgnored(
    name: string,
    relativePath: string,
    patterns: string[],
  ): boolean {
    const segments = relativePath.split(path.sep)
    for (const pattern of patterns) {
      // Simple glob matching for common patterns
      const cleanPattern = pattern
        .replace(/\*\*\//g, '')
        .replace(/\/\*\*/g, '')
        .replace(/\*/g, '.*')

      const regex = new RegExp(`^${cleanPattern}$`)

      // Check against directory name and each path segment
      if (regex.test(name)) return true
      for (const segment of segments) {
        if (regex.test(segment)) return true
      }
    }
    return false
  }
}
