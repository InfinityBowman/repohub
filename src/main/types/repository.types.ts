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
