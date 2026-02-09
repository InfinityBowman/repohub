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

export interface HealthCheckResult {
  success: boolean
  health?: DependencyHealth
  error?: string
}
