import type React from 'react';
import { RefreshCw } from 'lucide-react';
import type { DependencyHealth } from '@/types';
import { useHealth } from '@/hooks/useHealth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HealthDetailPopover({
  repoId,
  health,
  children,
}: {
  repoId: string;
  health: DependencyHealth;
  children: React.ReactNode;
}) {
  const { checkHealth, isChecking } = useHealth();
  const checking = isChecking(repoId);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className='w-64' align='start' onClick={e => e.stopPropagation()}>
        <div className='flex flex-col gap-3'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium'>Dependency Health</h4>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() => checkHealth(repoId)}
                    disabled={checking}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-check dependencies</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {health.vulnerabilities.total > 0 && (
            <div>
              <p className='text-muted-foreground mb-1 text-xs font-medium'>Vulnerabilities</p>
              <div className='grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs'>
                {health.vulnerabilities.critical > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-red-400'>Critical</span>
                    <span className='text-red-400'>{health.vulnerabilities.critical}</span>
                  </div>
                )}
                {health.vulnerabilities.high > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-orange-400'>High</span>
                    <span className='text-orange-400'>{health.vulnerabilities.high}</span>
                  </div>
                )}
                {health.vulnerabilities.moderate > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-yellow-400'>Moderate</span>
                    <span className='text-yellow-400'>{health.vulnerabilities.moderate}</span>
                  </div>
                )}
                {health.vulnerabilities.low > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Low</span>
                    <span>{health.vulnerabilities.low}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {health.vulnerabilities.total === 0 && (
            <p className='text-xs text-green-400'>No vulnerabilities found</p>
          )}

          {health.outdated.total > 0 && (
            <div>
              <p className='text-muted-foreground mb-1 text-xs font-medium'>
                Outdated ({health.outdated.total})
              </p>
              <div className='flex gap-3 text-xs'>
                {health.outdated.major > 0 && (
                  <span className='text-red-400'>{health.outdated.major} major</span>
                )}
                {health.outdated.minor > 0 && (
                  <span className='text-yellow-400'>{health.outdated.minor} minor</span>
                )}
                {health.outdated.patch > 0 && (
                  <span className='text-muted-foreground'>{health.outdated.patch} patch</span>
                )}
              </div>
            </div>
          )}

          {health.outdated.total === 0 && (
            <p className='text-xs text-green-400'>All dependencies up to date</p>
          )}

          <p className='text-muted-foreground text-[10px]'>
            Last checked: {formatTime(health.lastChecked)}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
