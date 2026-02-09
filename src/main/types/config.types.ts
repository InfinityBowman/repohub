export interface AppConfig {
  version: number
  scanDirectory: string
  ignorePatterns: string[]
  portScanInterval: number
  commandOverrides: Record<string, string>
  autoStartMonitoring: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  scanDirectory: '',
  ignorePatterns: ['**/node_modules', '**/.git', '**/ThirdParty/**'],
  portScanInterval: 5000,
  commandOverrides: {},
  autoStartMonitoring: true,
}
