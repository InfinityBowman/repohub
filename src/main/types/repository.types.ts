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
  workspace?: WorkspaceInfo
}
