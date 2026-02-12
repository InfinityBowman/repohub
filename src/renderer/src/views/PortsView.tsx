import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Skull,
  ExternalLink,
  Search,
  AlertCircle,
  Check,
  ArrowUpDown,
} from 'lucide-react';
import { usePorts } from '@/hooks/usePorts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { PortInfo } from '@/types';

/* ─── Process category detection ────────────────────────────────── */

type PortCategory = 'dev' | 'database' | 'infra' | 'app' | 'other';

const CATEGORY_META: Record<PortCategory, { label: string; className: string; order: number }> = {
  dev: { label: 'Dev', className: 'border-blue-800/50 bg-blue-900/30 text-blue-400', order: 0 },
  database: {
    label: 'Database',
    className: 'border-amber-800/50 bg-amber-900/30 text-amber-400',
    order: 1,
  },
  infra: {
    label: 'Infra',
    className: 'border-purple-800/50 bg-purple-900/30 text-purple-400',
    order: 2,
  },
  other: { label: 'Other', className: 'border-zinc-700/50 bg-zinc-800/30 text-zinc-400', order: 3 },
  app: { label: 'App', className: 'border-zinc-700/50 bg-zinc-800/30 text-zinc-500', order: 4 },
};

const DEV_COMMANDS = new Set([
  'node',
  'vite',
  'next',
  'nuxt',
  'webpack',
  'esbuild',
  'turbo',
  'tsx',
  'ts-node',
  'bun',
  'deno',
  'python',
  'python3',
  'uvicorn',
  'gunicorn',
  'flask',
  'django',
  'cargo',
  'go',
  'java',
  'ruby',
  'rails',
  'puma',
  'php',
  'dotnet',
  'remix',
  'astro',
  'wrangler',
  'netlify',
  'vercel',
  'expo',
]);

const DB_COMMANDS = new Set([
  'postgres',
  'postgresql',
  'mysqld',
  'mysql',
  'mongod',
  'mongos',
  'redis-server',
  'redis',
  'memcached',
  'clickhouse',
  'elasticsearch',
  'cassandra',
  'cockroach',
  'sqlite',
  'mariadb',
  'couchdb',
]);

const INFRA_COMMANDS = new Set([
  'docker',
  'containerd',
  'nginx',
  'apache',
  'httpd',
  'traefik',
  'caddy',
  'consul',
  'vault',
  'envoy',
  'haproxy',
  'minio',
  'etcd',
  'grafana',
  'prometheus',
]);

const APP_COMMANDS = new Set([
  'discord',
  'slack',
  'spotify',
  'figma',
  'zoom',
  'teams',
  'raycast',
  'alfred',
  '1password',
  'dropbox',
  'notion',
  'linear',
  'chrome',
  'firefox',
  'safari',
  'brave',
  'arc',
  'skype',
  'telegram',
  'whatsapp',
  'signal',
]);

function categorize(port: PortInfo): PortCategory {
  if (port.managed) return 'dev';

  const cmd = port.command.toLowerCase();

  if (DEV_COMMANDS.has(cmd)) return 'dev';
  if (DB_COMMANDS.has(cmd)) return 'database';
  if (INFRA_COMMANDS.has(cmd)) return 'infra';
  if (APP_COMMANDS.has(cmd)) return 'app';

  // Well-known port ranges as fallback
  const p = port.port;
  if (p >= 3000 && p <= 9999) return 'dev';
  if (p === 5432 || p === 3306 || p === 27017 || p === 6379) return 'database';

  return 'other';
}

/* ─── Sort modes ────────────────────────────────────────────────── */

type SortMode = 'category' | 'port' | 'newest' | 'command';

/* ─── Relative time helper ──────────────────────────────────────── */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

/* ─── Component ─────────────────────────────────────────────────── */

export function PortsView() {
  const { ports, error, firstSeen, killByPort, refresh } = usePorts();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [managedOnly, setManagedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [pendingKill, setPendingKill] = useState<PortInfo | null>(null);
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  // Refresh on mount (navigating to tab)
  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredPorts = useMemo(() => {
    let result = ports;

    if (managedOnly) {
      result = result.filter(p => p.managed);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        p =>
          p.command.toLowerCase().includes(q) ||
          String(p.port).includes(q) ||
          (p.repoName && p.repoName.toLowerCase().includes(q)) ||
          CATEGORY_META[categorize(p)].label.toLowerCase().includes(q),
      );
    }

    // Sort
    const sorted = [...result];
    switch (sortMode) {
      case 'category':
        sorted.sort((a, b) => {
          const ca = CATEGORY_META[categorize(a)].order;
          const cb = CATEGORY_META[categorize(b)].order;
          if (ca !== cb) return ca - cb;
          return a.port - b.port;
        });
        break;
      case 'port':
        sorted.sort((a, b) => a.port - b.port);
        break;
      case 'newest':
        sorted.sort((a, b) => (firstSeen[b.port] ?? 0) - (firstSeen[a.port] ?? 0));
        break;
      case 'command':
        sorted.sort((a, b) => a.command.localeCompare(b.command));
        break;
    }

    return sorted;
  }, [ports, search, managedOnly, sortMode, firstSeen]);

  const handleCopyPort = async (port: number) => {
    await navigator.clipboard.writeText(`localhost:${port}`);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 2000);
  };

  const handleConfirmKill = async () => {
    if (!pendingKill) return;
    await killByPort(pendingKill.port);
    setPendingKill(null);
  };

  return (
    <div className='flex h-full flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h2 className='text-xl font-semibold'>Open Ports</h2>
          <Badge variant='outline' className='border-green-800/50 bg-green-900/30 text-green-400'>
            <span className='mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-400' />
            Monitoring
          </Badge>
        </div>
        <Button variant='outline' size='sm' onClick={refresh}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {/* Search, sort & filter bar */}
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Filter by command, port, or project...'
            className='rounded-xl pl-9'
          />
        </div>
        <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
          <SelectTrigger size='sm' className='gap-1.5 text-xs'>
            <ArrowUpDown className='h-3.5 w-3.5' />
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value='category'>Category</SelectItem>
            <SelectItem value='port'>Port</SelectItem>
            <SelectItem value='newest'>Newest</SelectItem>
            <SelectItem value='command'>Command</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={managedOnly ? 'secondary' : 'outline'}
          size='sm'
          onClick={() => setManagedOnly(!managedOnly)}
        >
          Managed only
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className='flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-sm text-red-400'>
          <AlertCircle className='h-4 w-4 shrink-0' />
          <span>Port scan error: {error}</span>
        </div>
      )}

      {filteredPorts.length === 0 ?
        <div className='text-muted-foreground py-12 text-center'>
          {ports.length === 0 ?
            'No open ports detected on localhost.'
          : 'No ports match the current filter.'}
        </div>
      : <div className='flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto'>
          {filteredPorts.map(port => {
            const cat = categorize(port);
            const meta = CATEGORY_META[cat];
            const seen = firstSeen[port.port];

            return (
              <div
                key={port.port}
                className='bg-card flex items-center justify-between rounded-lg border px-3 py-2.5'
              >
                <div className='flex items-center gap-3'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleCopyPort(port.port)}
                        className='bg-secondary hover:bg-secondary/80 flex h-8 w-14 items-center justify-center rounded font-mono text-xs font-semibold transition-colors'
                      >
                        {copiedPort === port.port ?
                          <Check className='h-3.5 w-3.5 text-green-400' />
                        : <>:{port.port}</>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copiedPort === port.port ?
                        'Copied!'
                      : 'Click to copy localhost:' + port.port}
                    </TooltipContent>
                  </Tooltip>
                  <div>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium'>{port.command}</span>
                      <span className='text-muted-foreground text-xs'>PID {port.pid}</span>
                      <Badge
                        variant='outline'
                        className={`px-1.5 py-0 text-[10px] leading-relaxed ${meta.className}`}
                      >
                        {meta.label}
                      </Badge>
                      {port.managed && (
                        <Badge variant='secondary' className='text-xs'>
                          Managed
                        </Badge>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      {port.repoName && (
                        <p className='text-xs'>
                          <span className='text-muted-foreground'>Project: </span>
                          {port.repoId ?
                            <button
                              onClick={() => navigate(`/repo/${port.repoId}`)}
                              className='cursor-pointer text-blue-400 hover:underline'
                            >
                              {port.repoName}
                            </button>
                          : <span className='text-muted-foreground'>{port.repoName}</span>}
                        </p>
                      )}
                      {seen && (
                        <span className='text-muted-foreground text-[11px]'>{timeAgo(seen)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='xs'
                    onClick={() => {
                      window.open(`http://localhost:${port.port}`, '_blank');
                    }}
                  >
                    <ExternalLink />
                    Open
                  </Button>
                  <Separator orientation='vertical' className='h-4' />
                  <Button
                    variant='ghost'
                    size='xs'
                    className='text-destructive-foreground hover:bg-destructive/20'
                    onClick={() => setPendingKill(port)}
                  >
                    <Skull />
                    Kill
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      }

      {/* Kill confirmation dialog */}
      <Dialog open={!!pendingKill} onOpenChange={open => !open && setPendingKill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kill process?</DialogTitle>
            <DialogDescription>
              This will send SIGTERM to the process. If it doesn't stop within 3 seconds, SIGKILL
              will be used.
            </DialogDescription>
          </DialogHeader>
          {pendingKill && (
            <div className='bg-secondary rounded-lg p-3 text-sm'>
              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground'>Command:</span>
                <span className='font-mono font-medium'>{pendingKill.command}</span>
              </div>
              <div className='mt-1 flex items-center gap-2'>
                <span className='text-muted-foreground'>PID:</span>
                <span className='font-mono'>{pendingKill.pid}</span>
              </div>
              <div className='mt-1 flex items-center gap-2'>
                <span className='text-muted-foreground'>Port:</span>
                <span className='font-mono'>{pendingKill.port}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setPendingKill(null)}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleConfirmKill}>
              <Skull className='h-4 w-4' />
              Kill process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
