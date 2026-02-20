import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProcessService } from './ProcessService';
import type { PortInfo } from '../types/port.types';

const execAsync = promisify(exec);

/* ─── Well-known ports ────────────────────────────────────────── */

const WELL_KNOWN_PORTS: Record<number, string> = {
  21: 'FTP Server',
  22: 'SSH Server',
  25: 'SMTP Server',
  53: 'DNS Server',
  80: 'HTTP Server',
  443: 'HTTPS Server',
  631: 'CUPS Print Server',
  993: 'IMAP Server',
  1433: 'SQL Server',
  1521: 'Oracle DB',
  2181: 'ZooKeeper',
  2379: 'etcd',
  3000: 'Dev Server',
  3306: 'MySQL',
  4200: 'Angular Dev Server',
  4444: 'Selenium Grid',
  5000: 'Flask / Dev Server',
  5173: 'Vite Dev Server',
  5174: 'Vite Dev Server',
  5432: 'PostgreSQL',
  5500: 'Live Server',
  5672: 'RabbitMQ',
  5900: 'VNC Server',
  6379: 'Redis',
  6380: 'Redis',
  7474: 'Neo4j',
  8000: 'Dev Server',
  8080: 'HTTP Proxy / Dev Server',
  8081: 'Dev Server',
  8443: 'HTTPS Alt',
  8500: 'Consul',
  8761: 'Eureka',
  8888: 'Jupyter Notebook',
  9000: 'PHP-FPM / SonarQube',
  9090: 'Prometheus',
  9092: 'Kafka',
  9200: 'Elasticsearch',
  9300: 'Elasticsearch Transport',
  11211: 'Memcached',
  15672: 'RabbitMQ Management',
  27017: 'MongoDB',
  27018: 'MongoDB',
};

/* ─── Pattern matcher for full command → friendly description ── */

interface CommandPattern {
  test: RegExp;
  label: string | ((m: RegExpMatchArray) => string);
}

const COMMAND_PATTERNS: CommandPattern[] = [
  // JavaScript / Node ecosystem
  { test: /vite/, label: 'Vite Dev Server' },
  { test: /next[\s/]/, label: 'Next.js Dev Server' },
  { test: /next-server/, label: 'Next.js Server' },
  { test: /nuxt/, label: 'Nuxt Dev Server' },
  { test: /remix[\s/]/, label: 'Remix Dev Server' },
  { test: /astro/, label: 'Astro Dev Server' },
  { test: /gatsby/, label: 'Gatsby Dev Server' },
  { test: /webpack[\s-]dev[\s-]server/, label: 'Webpack Dev Server' },
  { test: /webpack/, label: 'Webpack' },
  { test: /esbuild/, label: 'esbuild' },
  { test: /turbo/, label: 'Turborepo' },
  { test: /storybook/, label: 'Storybook' },
  { test: /jest/, label: 'Jest' },
  { test: /vitest/, label: 'Vitest' },
  { test: /playwright/, label: 'Playwright' },
  { test: /cypress/, label: 'Cypress' },
  { test: /express/, label: 'Express Server' },
  { test: /fastify/, label: 'Fastify Server' },
  { test: /koa/, label: 'Koa Server' },
  { test: /hapi/, label: 'Hapi Server' },
  { test: /nestjs/, label: 'NestJS Server' },
  { test: /nest[\s/]/, label: 'NestJS Server' },
  { test: /wrangler/, label: 'Cloudflare Workers (Wrangler)' },
  { test: /netlify[\s/]dev/, label: 'Netlify Dev' },
  { test: /vercel[\s/]dev/, label: 'Vercel Dev' },
  { test: /expo/, label: 'Expo Dev Server' },
  { test: /react-native/, label: 'React Native Dev Server' },
  { test: /react-scripts/, label: 'Create React App' },
  { test: /electron/, label: 'Electron App' },
  { test: /prisma[\s/]studio/, label: 'Prisma Studio' },
  { test: /ts-node/, label: 'TypeScript Node' },
  { test: /tsx[\s/]/, label: 'TSX Runner' },
  { test: /nodemon/, label: 'Nodemon' },

  // Python ecosystem
  { test: /ipykernel/, label: 'Jupyter Notebook Kernel' },
  { test: /jupyter[\s-]notebook/, label: 'Jupyter Notebook' },
  { test: /jupyter[\s-]lab/, label: 'JupyterLab' },
  { test: /jupyter/, label: 'Jupyter' },
  { test: /uvicorn/, label: 'Uvicorn ASGI Server' },
  { test: /gunicorn/, label: 'Gunicorn WSGI Server' },
  { test: /flask/, label: 'Flask Dev Server' },
  { test: /django/, label: 'Django Dev Server' },
  { test: /celery/, label: 'Celery Worker' },
  { test: /streamlit/, label: 'Streamlit App' },
  { test: /gradio/, label: 'Gradio App' },
  { test: /fastapi/, label: 'FastAPI Server' },
  { test: /manage\.py\s+runserver/, label: 'Django Dev Server' },
  { test: /python.*-m\s+http\.server/, label: 'Python HTTP Server' },

  // Ruby
  { test: /puma/, label: 'Puma (Ruby)' },
  { test: /rails[\s/]server|rails\s+s\b/, label: 'Rails Server' },
  { test: /sidekiq/, label: 'Sidekiq Worker' },

  // Go
  { test: /air/, label: 'Air (Go Live Reload)' },

  // Rust
  { test: /cargo[\s-]watch/, label: 'Cargo Watch' },

  // Java / JVM
  { test: /spring[\s-]boot/, label: 'Spring Boot' },
  { test: /gradle/, label: 'Gradle' },
  { test: /tomcat/, label: 'Apache Tomcat' },

  // PHP
  { test: /php[\s-].*-S/, label: 'PHP Built-in Server' },
  { test: /artisan\s+serve/, label: 'Laravel Artisan' },

  // Databases
  { test: /postgres/, label: 'PostgreSQL' },
  { test: /mysqld/, label: 'MySQL Server' },
  { test: /mongod/, label: 'MongoDB Server' },
  { test: /mongos/, label: 'MongoDB Router' },
  { test: /redis-server/, label: 'Redis Server' },
  { test: /clickhouse/, label: 'ClickHouse' },
  { test: /elasticsearch/, label: 'Elasticsearch' },
  { test: /cassandra/, label: 'Cassandra' },
  { test: /cockroach/, label: 'CockroachDB' },

  // Infrastructure
  { test: /nginx/, label: 'Nginx' },
  { test: /httpd|apache/, label: 'Apache HTTP Server' },
  { test: /docker/, label: 'Docker' },
  { test: /containerd/, label: 'containerd' },
  { test: /traefik/, label: 'Traefik Proxy' },
  { test: /caddy/, label: 'Caddy Server' },
  { test: /consul/, label: 'Consul' },
  { test: /vault/, label: 'Vault' },
  { test: /envoy/, label: 'Envoy Proxy' },
  { test: /haproxy/, label: 'HAProxy' },
  { test: /minio/, label: 'MinIO' },
  { test: /grafana/, label: 'Grafana' },
  { test: /prometheus/, label: 'Prometheus' },

  // Desktop apps / tools
  { test: /code[\s-]helper|code\s+--/, label: 'VS Code' },
  { test: /cursor/, label: 'Cursor Editor' },

  // Generic runtimes (last — catch-all)
  { test: /\bbun\b/, label: 'Bun' },
  { test: /\bdeno\b/, label: 'Deno' },
];

function describePort(port: PortInfo): string | undefined {
  const cmd = port.fullCommand;
  if (cmd) {
    for (const pattern of COMMAND_PATTERNS) {
      const match = cmd.match(pattern.test);
      if (match) {
        return typeof pattern.label === 'function' ? pattern.label(match) : pattern.label;
      }
    }
  }

  // Fall back to well-known port numbers
  const wellKnown = WELL_KNOWN_PORTS[port.port];
  if (wellKnown) return wellKnown;

  // Generic runtime labels based on lsof command name
  const name = port.command.toLowerCase();
  if (name === 'node') return 'Node.js Process';
  if (name === 'python' || name === 'python3') return 'Python Process';
  if (name === 'ruby') return 'Ruby Process';
  if (name === 'java') return 'Java Process';
  if (name === 'go') return 'Go Process';
  if (name === 'dotnet') return '.NET Process';
  if (name === 'php') return 'PHP Process';

  return undefined;
}

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

      await this.enrichWithProcessInfo(ports);

      return ports;
    } catch (err: any) {
      this.emit('scanError', err.message ?? 'Failed to scan ports');
      return [];
    }
  }

  private async enrichWithProcessInfo(ports: PortInfo[]): Promise<void> {
    if (ports.length === 0) return;

    try {
      const pids = [...new Set(ports.map(p => p.pid))];
      const { stdout } = await execAsync(
        `ps -o pid=,ppid=,args= -p ${pids.join(',')}`,
        { timeout: 3000 },
      );

      // Parse ps output: each line is "  PID  PPID  ARGS..."
      const pidMap = new Map<number, { ppid: number; args: string }>();
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (match) {
          pidMap.set(parseInt(match[1], 10), {
            ppid: parseInt(match[2], 10),
            args: match[3],
          });
        }
      }

      // Collect parent PIDs we need to look up
      const parentPids = new Set<number>();
      for (const info of pidMap.values()) {
        if (info.ppid > 1 && !pidMap.has(info.ppid)) {
          parentPids.add(info.ppid);
        }
      }

      // Batch lookup parent commands
      const parentMap = new Map<number, string>();
      if (parentPids.size > 0) {
        try {
          const { stdout: parentStdout } = await execAsync(
            `ps -o pid=,comm= -p ${[...parentPids].join(',')}`,
            { timeout: 3000 },
          );
          for (const line of parentStdout.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const match = trimmed.match(/^(\d+)\s+(.+)$/);
            if (match) {
              parentMap.set(parseInt(match[1], 10), match[2].trim());
            }
          }
        } catch {
          // Parent lookup is best-effort
        }
      }

      // Apply enrichment to each port
      for (const port of ports) {
        const info = pidMap.get(port.pid);
        if (!info) continue;

        port.fullCommand = info.args;
        if (info.ppid > 1) {
          port.parentPid = info.ppid;
          port.parentCommand = parentMap.get(info.ppid) ?? pidMap.get(info.ppid)?.args?.split(/\s+/)[0];
        }
        port.description = describePort(port);
      }
    } catch {
      // Enrichment is best-effort — basic port info still works
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
