import { EventEmitter } from 'events'
import * as pty from 'node-pty'
import { RepositoryService } from './RepositoryService'
import { ConfigService } from './ConfigService'
import type { ProcessInfo, ProcessOutputData, ProcessResult } from '../types/process.types'

interface ManagedProcess {
  repoId: string
  repoName: string
  pid: number
  command: string
  ptyProcess: pty.IPty
  startTime: number
}

export class ProcessService extends EventEmitter {
  private processes = new Map<string, ManagedProcess>()
  private repositoryService: RepositoryService
  private configService: ConfigService

  constructor(
    repositoryService: RepositoryService,
    configService: ConfigService,
  ) {
    super()
    this.repositoryService = repositoryService
    this.configService = configService
  }

  async start(repoId: string, commandOverride?: string): Promise<ProcessResult> {
    // Stop existing process for this repo
    if (this.processes.has(repoId)) {
      await this.stop(repoId)
    }

    const repo = this.repositoryService.getById(repoId)
    if (!repo) {
      return { success: false, error: `Repository ${repoId} not found` }
    }

    const command =
      commandOverride ||
      this.configService.getCommandOverride(repoId) ||
      repo.defaultCommand

    if (!command) {
      return {
        success: false,
        error: `No command configured for ${repo.name}`,
      }
    }

    try {
      const shell = process.env.SHELL || '/bin/zsh'
      const ptyProcess = pty.spawn(shell, ['-c', command], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: repo.path,
        env: process.env as Record<string, string>,
      })

      const managed: ManagedProcess = {
        repoId,
        repoName: repo.name,
        pid: ptyProcess.pid,
        command,
        ptyProcess,
        startTime: Date.now(),
      }

      let buffer = ''
      let bufferTimer: NodeJS.Timeout | null = null

      ptyProcess.onData((data: string) => {
        buffer += data

        if (bufferTimer) clearTimeout(bufferTimer)

        bufferTimer = setTimeout(() => {
          const output: ProcessOutputData = {
            repoId,
            data: buffer,
            timestamp: Date.now(),
          }
          this.emit('output', output)
          buffer = ''
        }, 50)
      })

      ptyProcess.onExit(({ exitCode }) => {
        // Flush any remaining buffered output
        if (bufferTimer) {
          clearTimeout(bufferTimer)
          if (buffer) {
            this.emit('output', { repoId, data: buffer, timestamp: Date.now() })
            buffer = ''
          }
        }
        this.processes.delete(repoId)
        const info: ProcessInfo = {
          repoId,
          repoName: repo.name,
          pid: managed.pid,
          command,
          status: 'stopped',
          startTime: managed.startTime,
          exitCode: exitCode,
        }
        this.emit('status-changed', info)
      })

      this.processes.set(repoId, managed)

      const info: ProcessInfo = {
        repoId,
        repoName: repo.name,
        pid: ptyProcess.pid,
        command,
        status: 'running',
        startTime: managed.startTime,
      }
      this.emit('status-changed', info)

      return { success: true, pid: ptyProcess.pid, command }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async stop(repoId: string): Promise<void> {
    const managed = this.processes.get(repoId)
    if (!managed) return

    try {
      managed.ptyProcess.kill()
    } catch {
      // Already dead
    }

    this.processes.delete(repoId)
  }

  async restart(repoId: string): Promise<ProcessResult> {
    const managed = this.processes.get(repoId)
    const command = managed?.command
    await this.stop(repoId)

    // Small delay to let the process fully terminate
    await new Promise((resolve) => setTimeout(resolve, 500))

    return this.start(repoId, command)
  }

  getAll(): ProcessInfo[] {
    const result: ProcessInfo[] = []
    for (const [, managed] of this.processes) {
      result.push({
        repoId: managed.repoId,
        repoName: managed.repoName,
        pid: managed.pid,
        command: managed.command,
        status: 'running',
        startTime: managed.startTime,
      })
    }
    return result
  }

  getByPid(pid: number): ManagedProcess | undefined {
    for (const [, managed] of this.processes) {
      if (managed.pid === pid) return managed
    }
    return undefined
  }

  isRunning(repoId: string): boolean {
    return this.processes.has(repoId)
  }

  resize(repoId: string, cols: number, rows: number): void {
    const managed = this.processes.get(repoId)
    if (managed) {
      managed.ptyProcess.resize(cols, rows)
    }
  }

  stopAll(): void {
    for (const [repoId] of this.processes) {
      this.stop(repoId)
    }
  }
}
