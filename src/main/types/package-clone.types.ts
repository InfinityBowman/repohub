export interface CloneStatus {
  cloned: boolean;
  path?: string;
  clonedAt?: number;
}

export interface FileNode {
  name: string;
  path: string; // relative to clone root
  type: 'file' | 'directory';
  size?: number;
}

export interface CloneResult {
  success: boolean;
  error?: string;
}
