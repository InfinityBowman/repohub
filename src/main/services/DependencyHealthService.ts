import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { RepositoryService } from './RepositoryService'
import type {
  DependencyHealth,
  HealthStatus,
  VulnerabilitySummary,
  OutdatedSummary,
} from '../types/health.types'

export class DependencyHealthService extends EventEmitter {
  private cache = new Map<string, DependencyHealth>()
  private repositoryService: RepositoryService

  constructor(repositoryService: RepositoryService) {
    super()
    this.repositoryService = repositoryService
  }

  async check(repoId: string): Promise<DependencyHealth> {
    const repo = this.repositoryService.getById(repoId)
    if (!repo) {
      throw new Error(`Repository ${repoId} not found`)
    }

    if (repo.projectType !== 'node' && repo.projectType !== 'monorepo') {
      throw new Error(`Health check only supported for Node.js projects`)
    }

    const packageManager = this.detectPackageManager(repo.path)
    const [vulnerabilities, outdated] = await Promise.all([
      this.runAudit(repo.path, packageManager),
      this.runOutdated(repo.path, packageManager),
    ])

    const status = this.calculateStatus(vulnerabilities, outdated)

    const health: DependencyHealth = {
      repoId,
      status,
      vulnerabilities,
      outdated,
      lastChecked: Date.now(),
    }

    this.cache.set(repoId, health)
    this.emit('health-changed', health)

    return health
  }

  async checkAll(repoIds: string[]): Promise<void> {
    for (const repoId of repoIds) {
      try {
        await this.check(repoId)
      } catch {
        // Skip repos that fail
      }
    }
  }

  get(repoId: string): DependencyHealth | null {
    return this.cache.get(repoId) || null
  }

  clear(repoId: string): void {
    this.cache.delete(repoId)
  }

  private detectPackageManager(dirPath: string): 'pnpm' | 'npm' | 'yarn' {
    if (fs.existsSync(path.join(dirPath, 'pnpm-lock.yaml'))) return 'pnpm'
    if (fs.existsSync(path.join(dirPath, 'yarn.lock'))) return 'yarn'
    return 'npm'
  }

  private runAudit(
    cwd: string,
    pm: 'pnpm' | 'npm' | 'yarn',
  ): Promise<VulnerabilitySummary> {
    return new Promise((resolve) => {
      const empty: VulnerabilitySummary = {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        info: 0,
        total: 0,
      }

      const args =
        pm === 'pnpm'
          ? ['audit', '--json']
          : pm === 'yarn'
            ? ['audit', '--json']
            : ['audit', '--json']

      execFile(pm, args, { cwd, timeout: 30000 }, (error, stdout) => {
        try {
          const data = JSON.parse(stdout || '{}')

          if (pm === 'npm') {
            const meta = data.metadata?.vulnerabilities || {}
            const result: VulnerabilitySummary = {
              critical: meta.critical || 0,
              high: meta.high || 0,
              moderate: meta.moderate || 0,
              low: meta.low || 0,
              info: meta.info || 0,
              total: meta.total || 0,
            }
            result.total =
              result.critical + result.high + result.moderate + result.low + result.info
            resolve(result)
          } else if (pm === 'pnpm') {
            // pnpm audit --json returns advisories
            const advisories = data.advisories || data.metadata?.vulnerabilities
            if (advisories && typeof advisories === 'object' && !Array.isArray(advisories) && 'critical' in advisories) {
              const result: VulnerabilitySummary = {
                critical: advisories.critical || 0,
                high: advisories.high || 0,
                moderate: advisories.moderate || 0,
                low: advisories.low || 0,
                info: advisories.info || 0,
                total: 0,
              }
              result.total =
                result.critical + result.high + result.moderate + result.low + result.info
              resolve(result)
            } else {
              // Count from advisory entries
              const result = { ...empty }
              const entries = Object.values(data.advisories || {}) as any[]
              for (const entry of entries) {
                const severity = entry.severity as string
                if (severity in result) {
                  result[severity as keyof VulnerabilitySummary]++
                }
              }
              result.total =
                result.critical + result.high + result.moderate + result.low + result.info
              resolve(result)
            }
          } else {
            resolve(empty)
          }
        } catch {
          resolve(empty)
        }
      })
    })
  }

  private runOutdated(
    cwd: string,
    pm: 'pnpm' | 'npm' | 'yarn',
  ): Promise<OutdatedSummary> {
    return new Promise((resolve) => {
      const empty: OutdatedSummary = { major: 0, minor: 0, patch: 0, total: 0 }

      const args =
        pm === 'pnpm'
          ? ['outdated', '--format', 'json']
          : pm === 'yarn'
            ? ['outdated', '--json']
            : ['outdated', '--json']

      execFile(pm, args, { cwd, timeout: 30000 }, (error, stdout) => {
        try {
          const data = JSON.parse(stdout || '{}')
          const result = { ...empty }

          // npm outdated --json returns { "pkg": { current, wanted, latest } }
          const entries = Array.isArray(data) ? data : Object.values(data)
          for (const entry of entries as any[]) {
            const current = entry.current || entry.version || ''
            const latest = entry.latest || ''
            if (!current || !latest) {
              result.patch++
              continue
            }
            const [curMajor, curMinor] = current.split('.').map(Number)
            const [latMajor, latMinor] = latest.split('.').map(Number)
            if (latMajor > curMajor) result.major++
            else if (latMinor > curMinor) result.minor++
            else result.patch++
          }

          result.total = result.major + result.minor + result.patch
          resolve(result)
        } catch {
          resolve(empty)
        }
      })
    })
  }

  private calculateStatus(
    vulns: VulnerabilitySummary,
    outdated: OutdatedSummary,
  ): HealthStatus {
    if (vulns.critical >= 1 || vulns.high >= 5) return 'red'
    if (vulns.high >= 1 || outdated.total >= 5) return 'yellow'
    return 'green'
  }
}
