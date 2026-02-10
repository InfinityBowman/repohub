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

export interface BranchInfo {
  name: string
  isCurrent: boolean
  isMerged: boolean
  upstream?: string
  lastCommit: string
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

export interface ScaffoldTemplate {
  name: string
  path: string
}

export interface ScaffoldRecipe {
  id: string
  name: string
  description: string
  command: string
  category: string
  applySetupFiles: boolean
  url?: string
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
  projectTemplatesDir: string
  scaffoldRecipes: ScaffoldRecipe[]
  hiddenDefaultRecipes: string[]
  setupTemplateDir: string
  codeSearchEnabled: boolean
  codeSearchExcludePatterns: string[]
  codeSearchMaxFileSize: number
}

export interface CodeChunk {
  id: string
  filePath: string
  relativePath: string
  language: string
  constructType: string
  constructName: string
  code: string
  startLine: number
  endLine: number
}

export interface SearchResult {
  chunk: CodeChunk
  score: number
}

export type IndexState = 'idle' | 'downloading-model' | 'indexing' | 'ready' | 'error'

export interface IndexStatus {
  state: IndexState
  totalFiles: number
  indexedFiles: number
  totalChunks: number
  currentFile?: string
  progress: number
  error?: string
}

export interface SearchOptions {
  query: string
  limit?: number
  minScore?: number
  languages?: string[]
  directories?: string[]
}

export interface ModelProgress {
  status: string
  progress: number
  loaded: number
  total: number
}

declare global {
  interface Window {
    electron: {
      repositories: {
        scan: () => Promise<Repository[]>
        rescan: () => Promise<Repository[]>
        getById: (id: string) => Promise<Repository | null>
        readFile: (repoId: string, relativePath: string) => Promise<string>
      }
      git: {
        listBranches: (repoId: string) => Promise<BranchInfo[]>
        deleteBranches: (repoId: string, branches: string[]) => Promise<{ results: { branch: string; success: boolean; error?: string }[] }>
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
      scaffold: {
        getTemplates: () => Promise<ScaffoldTemplate[]>
        createFromTemplate: (templateName: string, projectName: string) => Promise<{ success: boolean; error?: string }>
        getRecipes: () => Promise<ScaffoldRecipe[]>
        addRecipe: (recipe: ScaffoldRecipe) => Promise<void>
        removeRecipe: (id: string) => Promise<void>
        run: (recipeId: string, projectName: string) => Promise<{ success: boolean; error?: string }>
        write: (data: string) => Promise<void>
        resize: (cols: number, rows: number) => Promise<void>
        cancel: () => Promise<void>
      }
      search: {
        query: (options: SearchOptions) => Promise<SearchResult[]>
        startIndexing: (dirs?: string[]) => Promise<{ success: boolean }>
        getStatus: () => Promise<IndexStatus>
        ensureModel: () => Promise<{ success: boolean }>
        reindex: () => Promise<{ success: boolean }>
      }
      on: {
        repositoriesChanged: (callback: (repos: Repository[]) => void) => () => void
        processOutput: (callback: (data: ProcessOutputData) => void) => () => void
        processStatusChanged: (callback: (info: ProcessInfo) => void) => () => void
        portsChanged: (callback: (ports: PortInfo[]) => void) => () => void
        healthChanged: (callback: (health: DependencyHealth) => void) => () => void
        githubChanged: (callback: (data: { prsByRepo: Record<string, PRInfo | null>; allUserPRs: PRInfo[] }) => void) => () => void
        scaffoldOutput: (callback: (data: { data: string; timestamp: number }) => void) => () => void
        scaffoldDone: (callback: (data: { exitCode: number; projectName: string }) => void) => () => void
        searchStatusChanged: (callback: (status: IndexStatus) => void) => () => void
        searchModelProgress: (callback: (progress: ModelProgress) => void) => () => void
      }
    }
  }
}
