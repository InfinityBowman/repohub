import { useEffect } from 'react';
import { RefreshCw, Skull, ExternalLink } from 'lucide-react';
import { usePorts } from '@/hooks/usePorts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function PortsView() {
  const { ports, monitoring, killByPort, refresh } = usePorts();

  // Refresh on mount (navigating to tab)
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h2 className='text-xl font-semibold'>Open Ports</h2>
          {monitoring && (
            <Badge variant='outline' className='border-green-800/50 bg-green-900/30 text-green-400'>
              <span className='mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-400' />
              Monitoring
            </Badge>
          )}
        </div>
        <Button variant='outline' size='sm' onClick={refresh}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {ports.length === 0 ?
        <div className='text-muted-foreground py-12 text-center'>
          No open ports detected on localhost.
        </div>
      : <div className='flex flex-col gap-1.5'>
          {ports.map(port => (
            <div
              key={port.port}
              className='bg-card flex items-center justify-between rounded-lg border px-3 py-2.5'
            >
              <div className='flex items-center gap-3'>
                <div className='bg-secondary flex h-8 w-14 items-center justify-center rounded font-mono text-xs font-semibold'>
                  :{port.port}
                </div>
                <div>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium'>{port.command}</span>
                    <span className='text-muted-foreground text-xs'>PID {port.pid}</span>
                    {port.managed && (
                      <Badge variant='secondary' className='text-xs'>
                        Managed
                      </Badge>
                    )}
                  </div>
                  {port.repoName && (
                    <p className='text-muted-foreground text-xs'>Project: {port.repoName}</p>
                  )}
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
                  onClick={() => killByPort(port.port)}
                >
                  <Skull />
                  Kill
                </Button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
