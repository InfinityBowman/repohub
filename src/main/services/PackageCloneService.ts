import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Store from 'electron-store';
import type { CloneStatus, FileNode, CloneResult } from '../types/package-clone.types';

const execFileAsync = promisify(execFile);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const CLONE_TIMEOUT = 30_000; // 30 seconds

interface CloneStoreSchema {
  clones: Record<string, { path: string; clonedAt: number }>;
}

export class PackageCloneService {
  private clonesDir: string;
  private store: Store<CloneStoreSchema>;

  constructor() {
    this.clonesDir = path.join(app.getPath('userData'), 'package-clones');
    this.store = new Store<CloneStoreSchema>({
      name: 'package-clones',
      defaults: { clones: {} },
    });
    this.cleanupOrphanedEntries();
  }

  async clone(packageName: string, repoUrl: string): Promise<CloneResult> {
    // Validate URL — must be an https GitHub URL
    try {
      const parsed = new URL(repoUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
        return { success: false, error: 'Only HTTPS GitHub URLs are supported' };
      }
    } catch {
      return { success: false, error: 'Invalid repository URL' };
    }

    const dirName = this.sanitizeDirName(packageName);
    const clonePath = path.join(this.clonesDir, dirName);

    // Ensure parent directory exists
    await fs.mkdir(this.clonesDir, { recursive: true });

    // Remove existing clone if present
    try {
      await fs.rm(clonePath, { recursive: true, force: true });
    } catch {
      // Ignore — may not exist
    }

    try {
      // Use execFile to avoid shell interpretation (no command injection)
      await execFileAsync('git', ['clone', '--depth', '1', '--single-branch', repoUrl, clonePath], {
        timeout: CLONE_TIMEOUT,
      });

      // Store metadata
      const clones = this.store.get('clones');
      clones[packageName] = { path: clonePath, clonedAt: Date.now() };
      this.store.set('clones', clones);

      return { success: true };
    } catch (err: any) {
      // Clean up failed clone
      try {
        await fs.rm(clonePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      return { success: false, error: err.message || 'Clone failed' };
    }
  }

  async getCloneStatus(packageName: string): Promise<CloneStatus> {
    const clones = this.store.get('clones');
    const entry = clones[packageName];

    if (!entry) {
      return { cloned: false };
    }

    // Verify directory still exists on disk
    try {
      await fs.access(entry.path);
      return { cloned: true, path: entry.path, clonedAt: entry.clonedAt };
    } catch {
      // Directory was deleted externally — clean up metadata
      delete clones[packageName];
      this.store.set('clones', clones);
      return { cloned: false };
    }
  }

  async listFiles(packageName: string, relativePath: string): Promise<FileNode[]> {
    const clonePath = await this.resolveClonePath(packageName);
    if (!clonePath) throw new Error('Package not cloned');

    const targetDir = path.join(clonePath, relativePath);

    // Path traversal check
    if (!targetDir.startsWith(clonePath)) {
      throw new Error('Invalid path');
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });

    const nodes: FileNode[] = [];
    for (const entry of entries) {
      // Filter out .git directory
      if (entry.name === '.git') continue;

      const entryRelPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, path: entryRelPath, type: 'directory' });
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(path.join(targetDir, entry.name));
          nodes.push({ name: entry.name, path: entryRelPath, type: 'file', size: stat.size });
        } catch {
          nodes.push({ name: entry.name, path: entryRelPath, type: 'file' });
        }
      }
    }

    // Sort: directories first, then files, both alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  async readFile(packageName: string, relativePath: string): Promise<string> {
    const clonePath = await this.resolveClonePath(packageName);
    if (!clonePath) throw new Error('Package not cloned');

    const filePath = path.join(clonePath, relativePath);

    // Path traversal check
    if (!filePath.startsWith(clonePath)) {
      throw new Error('Invalid path');
    }

    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${Math.round(stat.size / 1024)}KB, max 1MB)`);
    }

    return fs.readFile(filePath, 'utf-8');
  }

  async deleteClone(packageName: string): Promise<CloneResult> {
    const clones = this.store.get('clones');
    const entry = clones[packageName];

    if (entry) {
      try {
        await fs.rm(entry.path, { recursive: true, force: true });
      } catch {
        // Ignore — directory may already be gone
      }
      delete clones[packageName];
      this.store.set('clones', clones);
    }

    return { success: true };
  }

  private async resolveClonePath(packageName: string): Promise<string | null> {
    const clones = this.store.get('clones');
    const entry = clones[packageName];
    if (!entry) return null;

    try {
      await fs.access(entry.path);
      return entry.path;
    } catch {
      return null;
    }
  }

  private sanitizeDirName(name: string): string {
    return (
      name
        .replace(/@/g, '')
        .replace(/\//g, '__')
        .replace(/\.\./g, '_')
        .replace(/^\.+/, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[<>:"|?*\x00-\x1F]/g, '_')
        .slice(0, 255)
    );
  }

  private async cleanupOrphanedEntries(): Promise<void> {
    const clones = this.store.get('clones');
    const valid: Record<string, { path: string; clonedAt: number }> = {};

    for (const [packageName, entry] of Object.entries(clones)) {
      try {
        await fs.access(entry.path);
        valid[packageName] = entry;
      } catch {
        // Directory gone — drop from store
      }
    }

    if (Object.keys(valid).length !== Object.keys(clones).length) {
      this.store.set('clones', valid);
    }
  }
}
