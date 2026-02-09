export type ProjectType =
  | 'node'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'swift'
  | 'unknown'

export interface Repository {
  id: string
  name: string
  path: string
  projectType: ProjectType
  defaultCommand: string | null
  lastModified: number
  gitBranch?: string
  gitDirty?: boolean
}

export interface ProcessInfo {
  repoId: string
  repoName: string
  pid: number
  command: string
  status: 'running' | 'stopped'
  startTime: number
  exitCode?: number
}

export interface ProcessOutputData {
  repoId: string
  data: string
  timestamp: number
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
      on: {
        repositoriesChanged: (callback: (repos: Repository[]) => void) => () => void
        processOutput: (callback: (data: ProcessOutputData) => void) => () => void
        processStatusChanged: (callback: (info: ProcessInfo) => void) => () => void
        portsChanged: (callback: (ports: PortInfo[]) => void) => () => void
      }
    }
  }
}
