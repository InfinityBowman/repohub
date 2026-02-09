export type ProjectType =
  | 'node'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'swift'
  | 'monorepo'
  | 'unknown'

export interface WorkspacePackage {
  name: string
  path: string
  relativePath: string
  scripts: Record<string, string>
  version?: string
}

export interface WorkspaceInfo {
  packages: WorkspacePackage[]
  hasTurbo: boolean
  packageManager: 'pnpm' | 'npm' | 'yarn'
}

export interface Repository {
  id: string
  name: string
  path: string
  projectType: ProjectType
  defaultCommand: string | null
  lastModified: number
  gitBranch?: string
  gitDirty?: boolean
  githubUrl?: string
  workspace?: WorkspaceInfo
}

export interface ProcessInfo {
  repoId: string
  repoName: string
  pid: number
  command: string
  status: 'running' | 'stopped'
  startTime: number
  exitCode?: number
  packageName?: string
}

export interface ProcessOutputData {
  repoId: string
  data: string
  timestamp: number
  packageName?: string
}

export type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown'

export interface VulnerabilitySummary {
  critical: number
  high: number
  moderate: number
  low: number
  info: number
  total: number
}

export interface OutdatedSummary {
  major: number
  minor: number
  patch: number
  total: number
}

export interface DependencyHealth {
  repoId: string
  status: HealthStatus
  vulnerabilities: VulnerabilitySummary
  outdated: OutdatedSummary
  lastChecked: number
}

export type CIStatus = 'success' | 'failure' | 'pending' | 'unknown'
export type PRState = 'open' | 'closed' | 'merged' | 'draft'
export type ReviewStatus = 'approved' | 'changes_requested' | 'review_required' | 'none'

export interface PRInfo {
  number: number
  title: string
  state: PRState
  branch: string
  baseBranch: string
  url: string
  ciStatus: CIStatus
  reviewStatus: ReviewStatus
  createdAt: string
  updatedAt: string
  repoId?: string
  repoName?: string
  repoFullName?: string
}

export interface GitHubStatus {
  available: boolean
  authenticated: boolean
  error?: string
}

export interface ProcessResult {
  success: boolean
  pid?: number
  command?: string
  error?: string
}

export interface PortInfo {
  port: number
  pid: number
  command: string
  repoId?: string
  repoName?: string
  managed: boolean
}

export interface AppConfig {
  version: number
  scanDirectory: string
  ignorePatterns: string[]
  portScanInterval: number
  commandOverrides: Record<string, string>
  autoStartMonitoring: boolean
}

declare global {
  interface Window {
    electron: {
      repositories: {
        scan: () => Promise<Repository[]>
        rescan: () => Promise<Repository[]>
        getById: (id: string) => Promise<Repository | null>
      }
      processes: {
        start: (repoId: string, command?: string) => Promise<ProcessResult>
        stop: (repoId: string) => Promise<{ success: boolean }>
        restart: (repoId: string) => Promise<ProcessResult>
        getAll: () => Promise<ProcessInfo[]>
        resize: (repoId: string, cols: number, rows: number) => Promise<void>
        startPackage: (repoId: string, packageName: string, scriptName: string) => Promise<ProcessResult>
        stopPackage: (repoId: string, packageName: string) => Promise<{ success: boolean }>
        restartPackage: (repoId: string, packageName: string, scriptName: string) => Promise<ProcessResult>
        resizePackage: (repoId: string, packageName: string, cols: number, rows: number) => Promise<void>
      }
      ports: {
        scan: () => Promise<PortInfo[]>
        startMonitoring: () => Promise<{ success: boolean }>
        stopMonitoring: () => Promise<{ success: boolean }>
        killByPort: (port: number) => Promise<{ success: boolean; error?: string }>
      }
      shell: {
        openInVSCode: (dirPath: string) => Promise<{ success: boolean; error?: string }>
        openInTerminal: (dirPath: string) => Promise<{ success: boolean; error?: string }>
        openUrl: (url: string) => Promise<{ success: boolean; error?: string }>
      }
      logs: {
        get: (repoId: string) => Promise<string>
        clear: (repoId: string) => Promise<{ success: boolean }>
      }
      config: {
        get: () => Promise<AppConfig>
        update: (config: Partial<AppConfig>) => Promise<AppConfig>
        setCommandOverride: (repoId: string, command: string) => Promise<{ success: boolean }>
        removeCommandOverride: (repoId: string) => Promise<{ success: boolean }>
      }
      health: {
        check: (repoId: string) => Promise<DependencyHealth>
        checkAll: (repoIds: string[]) => Promise<void>
        get: (repoId: string) => Promise<DependencyHealth | null>
        clear: (repoId: string) => Promise<void>
      }
      github: {
        checkAvailability: () => Promise<GitHubStatus>
        getPRForBranch: (repoId: string) => Promise<PRInfo | null>
        getAllUserPRs: () => Promise<PRInfo[]>
        refresh: () => Promise<void>
        createPR: (repoId: string) => Promise<{ success: boolean; error?: string }>
      }
      on: {
        repositoriesChanged: (callback: (repos: Repository[]) => void) => () => void
        processOutput: (callback: (data: ProcessOutputData) => void) => () => void
        processStatusChanged: (callback: (info: ProcessInfo) => void) => () => void
        portsChanged: (callback: (ports: PortInfo[]) => void) => () => void
        healthChanged: (callback: (health: DependencyHealth) => void) => () => void
        githubChanged: (callback: (data: { prsByRepo: Record<string, PRInfo | null>; allUserPRs: PRInfo[] }) => void) => () => void
      }
    }
  }
}
