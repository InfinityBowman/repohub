import type { ScaffoldRecipe } from './scaffold.types'

export interface AppConfig {
  version: number
  scanDirectory: string
  ignorePatterns: string[]
  portScanInterval: number
  commandOverrides: Record<string, string>
  autoStartMonitoring: boolean
  projectTemplatesDir: string
  scaffoldRecipes: ScaffoldRecipe[]
  hiddenDefaultRecipes: string[]
  setupTemplateDir: string
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
}
