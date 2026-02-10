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
      version: this.store.get('version'),
      scanDirectory: this.store.get('scanDirectory'),
      ignorePatterns: this.store.get('ignorePatterns'),
      portScanInterval: this.store.get('portScanInterval'),
      commandOverrides: this.store.get('commandOverrides'),
      autoStartMonitoring: this.store.get('autoStartMonitoring'),
      projectTemplatesDir: this.store.get('projectTemplatesDir'),
      scaffoldRecipes: this.store.get('scaffoldRecipes'),
      hiddenDefaultRecipes: this.store.get('hiddenDefaultRecipes'),
      setupTemplateDir: this.store.get('setupTemplateDir'),
      codeSearchEnabled: this.store.get('codeSearchEnabled') ?? DEFAULT_CONFIG.codeSearchEnabled,
      codeSearchExcludePatterns:
        this.store.get('codeSearchExcludePatterns') ?? DEFAULT_CONFIG.codeSearchExcludePatterns,
      codeSearchMaxFileSize:
        this.store.get('codeSearchMaxFileSize') ?? DEFAULT_CONFIG.codeSearchMaxFileSize,
      theme: this.store.get('theme') ?? DEFAULT_CONFIG.theme,
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
