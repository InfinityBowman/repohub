import fs from 'fs'
import path from 'path'
import type { WorkspaceInfo, WorkspacePackage } from '../types/repository.types'

export class WorkspaceDetector {
  detectWorkspace(dirPath: string): WorkspaceInfo | undefined {
    const workspaceYamlPath = path.join(dirPath, 'pnpm-workspace.yaml')
    if (!fs.existsSync(workspaceYamlPath)) return undefined

    try {
      const content = fs.readFileSync(workspaceYamlPath, 'utf-8')
      const globs = this.parseWorkspaceYaml(content)
      const packages = this.resolvePackages(dirPath, globs)
      const hasTurbo = fs.existsSync(path.join(dirPath, 'turbo.json'))

      return {
        packages,
        hasTurbo,
        packageManager: 'pnpm',
      }
    } catch {
      return undefined
    }
  }

  private parseWorkspaceYaml(content: string): string[] {
    // Simple YAML parser for pnpm-workspace.yaml
    // Format is typically:
    // packages:
    //   - 'packages/*'
    //   - 'apps/*'
    const globs: string[] = []
    const lines = content.split('\n')
    let inPackages = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === 'packages:') {
        inPackages = true
        continue
      }
      if (inPackages) {
        if (trimmed.startsWith('- ')) {
          const glob = trimmed.slice(2).replace(/['"]/g, '').trim()
          if (glob) globs.push(glob)
        } else if (trimmed && !trimmed.startsWith('#')) {
          break // End of packages section
        }
      }
    }

    return globs
  }

  private resolvePackages(rootDir: string, globs: string[]): WorkspacePackage[] {
    const packages: WorkspacePackage[] = []

    for (const glob of globs) {
      // Handle simple glob patterns like 'packages/*' or 'apps/*'
      const cleanGlob = glob.replace(/\/\*$/, '').replace(/\/\*\*$/, '')
      const parentDir = path.join(rootDir, cleanGlob)

      if (!fs.existsSync(parentDir)) continue

      try {
        const entries = fs.readdirSync(parentDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          if (entry.name.startsWith('.')) continue

          const pkgDir = path.join(parentDir, entry.name)
          const pkgJsonPath = path.join(pkgDir, 'package.json')

          if (!fs.existsSync(pkgJsonPath)) continue

          try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
            packages.push({
              name: pkgJson.name || entry.name,
              path: pkgDir,
              relativePath: path.relative(rootDir, pkgDir),
              scripts: pkgJson.scripts || {},
              version: pkgJson.version,
            })
          } catch {
            // Skip packages with invalid package.json
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    packages.sort((a, b) => a.name.localeCompare(b.name))
    return packages
  }
}
