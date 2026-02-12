import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProcessService } from './ProcessService';
import type { PortInfo } from '../types/port.types';

const execAsync = promisify(exec);

export class PortService extends EventEmitter {
  private scanInterval: NodeJS.Timeout | null = null;
  private lastPorts: PortInfo[] = [];
  private processService: ProcessService;
  private intervalMs: number;
  private pendingTimers = new Set<NodeJS.Timeout>();

  constructor(processService: ProcessService, intervalMs = 5000) {
    super();
    this.processService = processService;
    this.intervalMs = intervalMs;
  }

  async scanPorts(): Promise<PortInfo[]> {
    try {
      const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null');

      const ports: PortInfo[] = [];
      const seen = new Set<number>();
      const lines = stdout.split('\n').slice(1); // Skip header

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;

        const command = parts[0];
        const pid = parseInt(parts[1], 10);
        const nameField = parts[8];

        const portMatch = nameField.match(/:(\d+)$/);
        if (!portMatch) continue;

        const port = parseInt(portMatch[1], 10);
        if (seen.has(port)) continue;
        seen.add(port);

        const managedProcess = this.processService.getByPid(pid);

        ports.push({
          port,
          pid,
          command,
          repoId: managedProcess?.repoId,
          repoName: managedProcess?.repoName,
          managed: !!managedProcess,
        });
      }

      ports.sort((a, b) => a.port - b.port);
      return ports;
    } catch (err: any) {
      this.emit('scanError', err.message ?? 'Failed to scan ports');
      return [];
    }
  }

  startMonitoring(): void {
    if (this.scanInterval) return;

    // Immediate scan
    this.scanPorts().then(ports => {
      this.lastPorts = ports;
      this.emit('changed', ports);
    });

    this.scanInterval = setInterval(async () => {
      const ports = await this.scanPorts();
      const serialized = JSON.stringify(ports);
      const lastSerialized = JSON.stringify(this.lastPorts);

      if (serialized !== lastSerialized) {
        this.lastPorts = ports;
        this.emit('changed', ports);
      }
    }, this.intervalMs);
  }

  updateInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;
    if (this.scanInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  stopMonitoring(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }

  async killByPort(port: number): Promise<void> {
    const ports = await this.scanPorts();
    const portInfo = ports.find(p => p.port === port);

    if (!portInfo) {
      throw new Error(`No process found on port ${port}`);
    }

    try {
      process.kill(portInfo.pid, 'SIGTERM');
    } catch {
      // Process may have already exited
    }

    // Force kill after 3 seconds if still alive
    const killTimer = setTimeout(() => {
      this.pendingTimers.delete(killTimer);
      try {
        process.kill(portInfo.pid, 0);
        process.kill(portInfo.pid, 'SIGKILL');
      } catch {
        // Already dead
      }
    }, 3000);
    this.pendingTimers.add(killTimer);

    // Trigger rescan after a short delay
    const scanTimer = setTimeout(() => {
      this.pendingTimers.delete(scanTimer);
      this.scanPorts().then(ports => {
        this.lastPorts = ports;
        this.emit('changed', ports);
      });
    }, 500);
    this.pendingTimers.add(scanTimer);
  }

  getLastPorts(): PortInfo[] {
    return this.lastPorts;
  }
}
