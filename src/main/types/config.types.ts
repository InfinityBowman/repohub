import type { ScaffoldRecipe } from './scaffold.types';

export interface AppConfig {
  version: number;
  scanDirectory: string;
  ignorePatterns: string[];
  portScanInterval: number;
  commandOverrides: Record<string, string>;
  autoStartMonitoring: boolean;
  projectTemplatesDir: string;
  scaffoldRecipes: ScaffoldRecipe[];
  hiddenDefaultRecipes: string[];
  setupTemplateDir: string;
  codeSearchEnabled: boolean;
  codeSearchExcludePatterns: string[];
  codeSearchMaxFileSize: number;
  theme: 'default' | 'palenight';
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  scanDirectory: '',
  ignorePatterns: ['**/node_modules', '**/.git', '**/ThirdParty/**'],
  portScanInterval: 5000,
  commandOverrides: {},
  autoStartMonitoring: true,
  projectTemplatesDir: '',
  scaffoldRecipes: [],
  hiddenDefaultRecipes: [],
  setupTemplateDir: '',
  codeSearchEnabled: true,
  codeSearchExcludePatterns: [
    // Version control
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    // JS/Node
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.turbo/**',
    '**/.cache/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/*.chunk.js',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
    // Python
    '**/__pycache__/**',
    '**/.venv/**',
    '**/venv/**',
    '**/.env/**',
    '**/env/**',
    '**/.tox/**',
    '**/*.egg-info/**',
    '**/site-packages/**',
    // Rust
    '**/target/**',
    // Go
    '**/vendor/**',
    // Java
    '**/.gradle/**',
    '**/.mvn/**',
    // Swift
    '**/.build/**',
    '**/.swiftpm/**',
    // IDE / OS
    '**/.idea/**',
    '**/.vscode/**',
    '**/.DS_Store',
    // Generated / binary
    '**/*.map',
    '**/*.d.ts',
    '**/generated/**',
    '**/*.pb.go',
    '**/*.generated.*',
  ],
  codeSearchMaxFileSize: 1_048_576,
  theme: 'palenight',
};
