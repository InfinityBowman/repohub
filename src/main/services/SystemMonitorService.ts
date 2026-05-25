import { EventEmitter } from 'events';
import { OSUtils } from 'node-os-utils';

export interface SystemSnapshot {
  cpuPercent: number;
  memUsedPercent: number;
  memUsedGb: number;
  memTotalGb: number;
}

export class SystemMonitorService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private osu: OSUtils;
  private lastSnapshot: SystemSnapshot = {
    cpuPercent: 0,
    memUsedPercent: 0,
    memUsedGb: 0,
    memTotalGb: 0,
  };

  constructor(intervalMs = 2000) {
    super();
    this.intervalMs = intervalMs;
    this.osu = new OSUtils();
  }

  start(): void {
    this.update();
    this.timer = setInterval(() => this.update(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.osu.destroy();
  }

  getLastSnapshot(): SystemSnapshot {
    return this.lastSnapshot;
  }

  private async update(): Promise<void> {
    try {
      const [cpuResult, memResult] = await Promise.all([
        this.osu.cpu.usage(),
        this.osu.memory.detailed(),
      ]);

      const cpuPercent = cpuResult.data ?? 0;

      const memData = memResult.data;
      const breakdown = (memData as any)?.breakdown;
      const totalBytes = typeof this.osu.memory.totalMem() === 'number'
        ? this.osu.memory.totalMem() as number
        : 0;
      const totalGb = totalBytes / 1073741824;

      let usedPercent = memData?.usagePercentage ?? 0;
      let usedGb = 0;

      if (breakdown?.active !== undefined && breakdown?.wired !== undefined) {
        const activeBytes = this.parseSize(breakdown.active);
        const wiredBytes = this.parseSize(breakdown.wired);
        const compressedBytes = this.parseSize(breakdown.compressed);
        const usedBytes = activeBytes + wiredBytes + compressedBytes;
        usedGb = usedBytes / 1073741824;
        usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      } else {
        usedGb = totalGb * (usedPercent / 100);
      }

      this.lastSnapshot = {
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        memUsedPercent: Math.round(usedPercent * 10) / 10,
        memUsedGb: Math.round(usedGb * 100) / 100,
        memTotalGb: Math.round(totalGb * 100) / 100,
      };

      this.emit('snapshot', this.lastSnapshot);
    } catch {
      // Skip this tick on error
    }
  }

  private parseSize(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value?.bytes !== undefined) return value.bytes;
    if (typeof value === 'string') {
      const match = value.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
      if (match) {
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        if (unit === 'GB') return num * 1073741824;
        if (unit === 'MB') return num * 1048576;
        if (unit === 'KB') return num * 1024;
        return num;
      }
    }
    return 0;
  }
}
