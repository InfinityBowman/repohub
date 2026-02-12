import Store from 'electron-store';
import os from 'os';
import path from 'path';
import type { AppConfig } from '../types/config.types';
import { DEFAULT_CONFIG } from '../types/config.types';

export class ConfigService {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'config',
      defaults: {
        ...DEFAULT_CONFIG,
        scanDirectory: path.join(os.homedir(), 'Documents', 'Repos'),
      },
    });
  }

  get(): AppConfig {
    return {
      version: this.store.get('version') ?? DEFAULT_CONFIG.version,
      scanDirectory: this.store.get('scanDirectory') ?? DEFAULT_CONFIG.scanDirectory,
      ignorePatterns: this.store.get('ignorePatterns') ?? DEFAULT_CONFIG.ignorePatterns,
      portScanInterval: this.store.get('portScanInterval') ?? DEFAULT_CONFIG.portScanInterval,
      commandOverrides: this.store.get('commandOverrides') ?? DEFAULT_CONFIG.commandOverrides,
      projectTemplatesDir:
        this.store.get('projectTemplatesDir') ?? DEFAULT_CONFIG.projectTemplatesDir,
      scaffoldRecipes: this.store.get('scaffoldRecipes') ?? DEFAULT_CONFIG.scaffoldRecipes,
      hiddenDefaultRecipes:
        this.store.get('hiddenDefaultRecipes') ?? DEFAULT_CONFIG.hiddenDefaultRecipes,
      setupTemplateDir: this.store.get('setupTemplateDir') ?? DEFAULT_CONFIG.setupTemplateDir,
      codeSearchEnabled:
        this.store.get('codeSearchEnabled') ?? DEFAULT_CONFIG.codeSearchEnabled,
      codeSearchExcludePatterns:
        this.store.get('codeSearchExcludePatterns') ?? DEFAULT_CONFIG.codeSearchExcludePatterns,
      codeSearchMaxFileSize:
        this.store.get('codeSearchMaxFileSize') ?? DEFAULT_CONFIG.codeSearchMaxFileSize,
      theme: this.store.get('theme') ?? DEFAULT_CONFIG.theme,
      protectedBranches:
        this.store.get('protectedBranches') ?? DEFAULT_CONFIG.protectedBranches,
    };
  }

  update(updates: Partial<AppConfig>): AppConfig {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        this.store.set(key as keyof AppConfig, value as any);
      }
    }
    return this.get();
  }

  getCommandOverride(repoId: string): string | undefined {
    const overrides = this.store.get('commandOverrides');
    return overrides[repoId];
  }

  setCommandOverride(repoId: string, command: string): void {
    const overrides = this.store.get('commandOverrides');
    overrides[repoId] = command;
    this.store.set('commandOverrides', overrides);
  }

  removeCommandOverride(repoId: string): void {
    const overrides = this.store.get('commandOverrides');
    delete overrides[repoId];
    this.store.set('commandOverrides', overrides);
  }
}
