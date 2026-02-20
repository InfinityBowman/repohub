export interface PortInfo {
  port: number;
  pid: number;
  command: string;
  repoId?: string;
  repoName?: string;
  managed: boolean;
  fullCommand?: string;
  parentPid?: number;
  parentCommand?: string;
  description?: string;
}
