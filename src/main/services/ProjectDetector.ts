import fs from 'fs';
import path from 'path';
import type { ProjectType } from '../types/repository.types';

interface DetectionResult {
  projectType: ProjectType;
  defaultCommand: string | null;
}

export class ProjectDetector {
  detect(dirPath: string): DetectionResult {
    // Check for pnpm workspace monorepo before standard Node detection
    if (
      this.fileExists(dirPath, 'pnpm-workspace.yaml') &&
      this.fileExists(dirPath, 'package.json')
    ) {
      return {
        projectType: 'monorepo',
        defaultCommand: this.detectMonorepoCommand(dirPath),
      };
    }

    if (this.fileExists(dirPath, 'package.json')) {
      return {
        projectType: 'node',
        defaultCommand: this.detectNodeCommand(dirPath),
      };
    }

    if (this.fileExists(dirPath, 'Cargo.toml')) {
      return { projectType: 'rust', defaultCommand: 'cargo run' };
    }

    if (
      this.fileExists(dirPath, 'pyproject.toml') ||
      this.fileExists(dirPath, 'requirements.txt') ||
      this.fileExists(dirPath, 'setup.py')
    ) {
      return { projectType: 'python', defaultCommand: 'python main.py' };
    }

    if (this.fileExists(dirPath, 'go.mod')) {
      return { projectType: 'go', defaultCommand: 'go run .' };
    }

    if (this.fileExists(dirPath, 'Package.swift')) {
      return { projectType: 'swift', defaultCommand: 'swift run' };
    }

    if (this.hasExtension(dirPath, '.xcodeproj') || this.hasExtension(dirPath, '.xcworkspace')) {
      return { projectType: 'swift', defaultCommand: 'xcodebuild' };
    }

    if (
      this.fileExists(dirPath, 'pom.xml') ||
      this.fileExists(dirPath, 'build.gradle') ||
      this.fileExists(dirPath, 'build.gradle.kts')
    ) {
      return { projectType: 'java', defaultCommand: null };
    }

    return { projectType: 'unknown', defaultCommand: null };
  }

  private detectMonorepoCommand(dirPath: string): string {
    const hasTurbo = this.fileExists(dirPath, 'turbo.json');
    if (hasTurbo) {
      const pkg = this.readPackageJson(dirPath);
      if (pkg?.scripts?.dev) return 'turbo dev';
      if (pkg?.scripts?.build) return 'turbo build';
      return 'turbo dev';
    }
    return 'pnpm dev';
  }

  private detectNodeCommand(dirPath: string): string {
    const packageManager = this.detectPackageManager(dirPath);
    const pkg = this.readPackageJson(dirPath);

    if (pkg?.scripts?.dev) {
      return `${packageManager} dev`;
    }
    if (pkg?.scripts?.start) {
      return `${packageManager} start`;
    }

    return `${packageManager} dev`;
  }

  private detectPackageManager(dirPath: string): string {
    if (this.fileExists(dirPath, 'pnpm-lock.yaml')) return 'pnpm';
    if (this.fileExists(dirPath, 'yarn.lock')) return 'yarn';
    if (this.fileExists(dirPath, 'bun.lockb') || this.fileExists(dirPath, 'bun.lock')) return 'bun';
    return 'npm run';
  }

  private readPackageJson(dirPath: string): any {
    try {
      const content = fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private hasExtension(dirPath: string, ext: string): boolean {
    try {
      const entries = fs.readdirSync(dirPath);
      return entries.some(e => e.endsWith(ext));
    } catch {
      return false;
    }
  }

  private fileExists(dirPath: string, filename: string): boolean {
    try {
      fs.accessSync(path.join(dirPath, filename));
      return true;
    } catch {
      return false;
    }
  }
}
