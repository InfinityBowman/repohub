export interface ScaffoldRecipe {
  id: string
  name: string
  description: string
  command: string // shell command with {name} placeholder, empty for browser-based recipes
  category: string // "Frontend", "Full Stack", "API", "Desktop", "Python", "Monorepo"
  applySetupFiles: boolean // whether to copy template files after scaffold
  url?: string // if set, opens this URL and spawns a bare shell for the user to paste a command
}

export interface ScaffoldTemplate {
  name: string
  path: string
}
