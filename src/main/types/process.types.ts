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

export interface ProcessResult {
  success: boolean
  pid?: number
  command?: string
  error?: string
}
