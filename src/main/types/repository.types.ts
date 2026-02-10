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
