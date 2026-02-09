import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const MAX_LOG_SIZE = 100_000 // 100KB per repo

export class LogService {
  private logsDir: string

  constructor() {
    this.logsDir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }
  }

  private logPath(repoId: string): string {
    return path.join(this.logsDir, `${repoId}.log`)
  }

  append(repoId: string, data: string): void {
    const filePath = this.logPath(repoId)
    try {
      fs.appendFileSync(filePath, data)

      // Truncate if too large
      const stat = fs.statSync(filePath)
      if (stat.size > MAX_LOG_SIZE * 2) {
        const content = fs.readFileSync(filePath, 'utf-8')
        fs.writeFileSync(filePath, content.slice(-MAX_LOG_SIZE))
      }
    } catch {
      // Ignore write errors
    }
  }

  get(repoId: string): string {
    try {
      const filePath = this.logPath(repoId)
      if (!fs.existsSync(filePath)) return ''
      const content = fs.readFileSync(filePath, 'utf-8')
      // Return last MAX_LOG_SIZE chars
      if (content.length > MAX_LOG_SIZE) {
        return content.slice(-MAX_LOG_SIZE)
      }
      return content
    } catch {
      return ''
    }
  }

  clear(repoId: string): void {
    try {
      const filePath = this.logPath(repoId)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch {
      // Ignore
    }
  }
}
