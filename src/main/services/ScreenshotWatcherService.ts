import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { execFile } from 'child_process';

export interface ScreenshotInfo {
  path: string;
  name: string;
  timestamp: number;
}

export class ScreenshotWatcherService extends EventEmitter {
  private recent: ScreenshotInfo[] = [];
  private maxRecent = 8;
  private storageDir: string;
  private capturing = false;

  constructor() {
    super();
    this.storageDir = path.join(app.getPath('userData'), 'screenshots');
  }

  start(): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadExisting();
  }

  stop(): void {}

  getRecent(): ScreenshotInfo[] {
    return this.recent;
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  clearAll(): void {
    for (const info of this.recent) {
      try { fs.unlinkSync(info.path); } catch {}
    }
    this.recent = [];
  }

  capture(): void {
    if (this.capturing) return;
    this.capturing = true;

    const timestamp = Date.now();
    const filename = `screenshot-${timestamp}.png`;
    const destPath = path.join(this.storageDir, filename);

    execFile('screencapture', ['-i', destPath], (err) => {
      this.capturing = false;

      if (err) return;
      if (!fs.existsSync(destPath)) return;

      const info: ScreenshotInfo = { path: destPath, name: filename, timestamp };
      this.recent.unshift(info);
      this.recent = this.recent.slice(0, this.maxRecent);
      this.emit('screenshot', info);
      this.pruneOldFiles();
    });
  }

  private loadExisting(): void {
    try {
      const entries = fs.readdirSync(this.storageDir);
      const files: { path: string; name: string; mtime: number }[] = [];

      for (const entry of entries) {
        if (!entry.endsWith('.png')) continue;
        const fullPath = path.join(this.storageDir, entry);
        try {
          const stat = fs.statSync(fullPath);
          files.push({ path: fullPath, name: entry, mtime: stat.mtimeMs });
        } catch {}
      }

      files.sort((a, b) => b.mtime - a.mtime);
      this.recent = files.slice(0, this.maxRecent).map(f => ({
        path: f.path,
        name: f.name,
        timestamp: f.mtime,
      }));
    } catch {}
  }

  private pruneOldFiles(): void {
    try {
      const entries = fs.readdirSync(this.storageDir);
      const files = entries
        .filter(e => e.endsWith('.png'))
        .map(e => {
          const p = path.join(this.storageDir, e);
          return { path: p, mtime: fs.statSync(p).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      for (const file of files.slice(20)) {
        fs.unlinkSync(file.path);
      }
    } catch {}
  }
}
