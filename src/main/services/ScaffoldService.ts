import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';
import { ConfigService } from './ConfigService';
import type { ScaffoldRecipe, ScaffoldTemplate } from '../types/scaffold.types';

export class ScaffoldService extends EventEmitter {
  private configService: ConfigService;
  private activeProcess: pty.IPty | null = null;
  private activeProjectName: string | null = null;
  private activeRecipe: ScaffoldRecipe | null = null;

  constructor(configService: ConfigService) {
    super();
    this.configService = configService;
  }

  // ── Templates (primary flow) ──────────────────────────────────────

  getTemplates(): ScaffoldTemplate[] {
    const dir = this.configService.get().projectTemplatesDir;
    if (!dir || !fs.existsSync(dir)) return [];

    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(dir, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  createFromTemplate(
    templateName: string,
    projectName: string,
  ): { success: boolean; error?: string } {
    const config = this.configService.get();
    const scanDir = config.scanDirectory;
    const templatesDir = config.projectTemplatesDir;

    if (!scanDir) return { success: false, error: 'No scan directory configured' };
    if (!templatesDir) return { success: false, error: 'No templates directory configured' };

    const srcDir = path.join(templatesDir, templateName);
    const destDir = path.join(scanDir, projectName);

    if (!fs.existsSync(srcDir))
      return { success: false, error: `Template "${templateName}" not found` };
    if (fs.existsSync(destDir))
      return {
        success: false,
        error: `Directory "${projectName}" already exists`,
      };

    try {
      fs.mkdirSync(destDir, { recursive: true });
      this.copyDirRecursive(srcDir, destDir);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── Recipes (secondary / power-user flow) ─────────────────────────

  getRecipes(): ScaffoldRecipe[] {
    const config = this.configService.get();
    const hidden = new Set(config.hiddenDefaultRecipes);

    return config.scaffoldRecipes.filter(r => !hidden.has(r.id));
  }

  addRecipe(recipe: ScaffoldRecipe): void {
    const config = this.configService.get();
    const existing = config.scaffoldRecipes.findIndex(r => r.id === recipe.id);
    if (existing >= 0) {
      config.scaffoldRecipes[existing] = recipe;
    } else {
      config.scaffoldRecipes.push(recipe);
    }
    config.hiddenDefaultRecipes = config.hiddenDefaultRecipes.filter(id => id !== recipe.id);
    this.configService.update({
      scaffoldRecipes: config.scaffoldRecipes,
      hiddenDefaultRecipes: config.hiddenDefaultRecipes,
    });
  }

  removeRecipe(id: string): void {
    const config = this.configService.get();
    config.scaffoldRecipes = config.scaffoldRecipes.filter(r => r.id !== id);
    this.configService.update({ scaffoldRecipes: config.scaffoldRecipes });
  }

  run(recipeId: string, projectName: string): { success: boolean; error?: string } {
    if (this.activeProcess) {
      return { success: false, error: 'A scaffold process is already running' };
    }

    const recipes = this.getRecipes();
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
      return { success: false, error: `Recipe "${recipeId}" not found` };
    }

    const config = this.configService.get();
    const cwd = config.scanDirectory;
    if (!cwd) {
      return { success: false, error: 'No scan directory configured' };
    }

    const command = recipe.command ? recipe.command.replace(/\{name\}/g, projectName) : '';

    // Helper script so CLI tools can open URLs via Electron
    const browserScript = path.join(require('os').tmpdir(), 'repohub-browser-open.sh');
    fs.writeFileSync(browserScript, '#!/bin/sh\necho "@@REPOHUB_OPEN_URL@@$1"\n', { mode: 0o755 });

    if (recipe.url) {
      shell.openExternal(recipe.url);
    }

    try {
      const userShell = process.env.SHELL || '/bin/zsh';
      const args = command ? ['-c', command] : [];
      const ptyProcess = pty.spawn(userShell, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
          ...(process.env as Record<string, string>),
          BROWSER: browserScript,
        },
      });

      this.activeProcess = ptyProcess;
      this.activeProjectName = projectName;
      this.activeRecipe = recipe;

      let buffer = '';
      let bufferTimer: NodeJS.Timeout | null = null;
      let urlScanBuffer = '';

      ptyProcess.onData((data: string) => {
        buffer += data;
        urlScanBuffer += data;

        const markerMatch = urlScanBuffer.match(/@@REPOHUB_OPEN_URL@@(https?:\/\/[^\s\r\n]+)/);
        if (markerMatch) {
          shell.openExternal(markerMatch[1]);
          urlScanBuffer = '';
        }
        if (urlScanBuffer.length > 4096) {
          urlScanBuffer = urlScanBuffer.slice(-2048);
        }

        if (bufferTimer) clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => {
          this.emit('output', { data: buffer, timestamp: Date.now() });
          buffer = '';
        }, 50);
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (bufferTimer) {
          clearTimeout(bufferTimer);
          if (buffer) {
            this.emit('output', { data: buffer, timestamp: Date.now() });
            buffer = '';
          }
        }

        const pName = this.activeProjectName!;
        const activeRecipe = this.activeRecipe!;

        this.activeProcess = null;
        this.activeProjectName = null;
        this.activeRecipe = null;

        if (exitCode === 0 && activeRecipe.applySetupFiles) {
          const setupDir = this.configService.get().setupTemplateDir;
          if (setupDir) {
            const targetDir = path.join(cwd, pName);
            this.copySetupFiles(setupDir, targetDir);
          }
        }

        this.emit('done', { exitCode: exitCode ?? 1, projectName: pName });
      });

      return { success: true };
    } catch (err: any) {
      this.activeProcess = null;
      this.activeProjectName = null;
      this.activeRecipe = null;
      return { success: false, error: err.message };
    }
  }

  write(data: string): void {
    if (this.activeProcess) {
      this.activeProcess.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this.activeProcess) {
      this.activeProcess.resize(cols, rows);
    }
  }

  cancel(): void {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill();
      } catch {
        // Already dead
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private copySetupFiles(sourceDir: string, targetDir: string): void {
    try {
      if (!fs.existsSync(sourceDir)) return;
      if (!fs.existsSync(targetDir)) return;
      this.copyDirRecursive(sourceDir, targetDir);
    } catch {
      this.emit('output', {
        data: '\r\n[RepoHub] Warning: Failed to copy some setup template files.\r\n',
        timestamp: Date.now(),
      });
    }
  }

  private copyDirRecursive(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
