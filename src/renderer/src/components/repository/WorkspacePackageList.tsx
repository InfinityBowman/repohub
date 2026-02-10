import { Play, Square, RotateCcw, Package } from 'lucide-react';
import { useState } from 'react';
import type { Repository, WorkspacePackage } from '@/types';
import { useProcesses } from '@/hooks/useProcesses';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TerminalOutput } from '../process/TerminalOutput';

function PackageItem({ repo, pkg }: { repo: Repository; pkg: WorkspacePackage }) {
  const { isPackageRunning, startPackage, stopPackage, restartPackage, terminalData, processes } =
    useProcesses();
  const [showTerminal, setShowTerminal] = useState(false);

  const running = isPackageRunning(repo.id, pkg.name);
  const compositeKey = `${repo.id}:${pkg.name}`;
  const processInfo = processes[compositeKey];
  const scriptNames = Object.keys(pkg.scripts);
  const defaultScript =
    scriptNames.includes('dev') ? 'dev'
    : scriptNames.includes('start') ? 'start'
    : scriptNames[0] || null;

  const handleStart = async () => {
    if (!defaultScript) return;
    const result = await startPackage(repo.id, pkg.name, defaultScript);
    if (result.success) setShowTerminal(true);
  };

  const handleStop = async () => {
    await stopPackage(repo.id, pkg.name);
  };

  const handleRestart = async () => {
    if (!defaultScript) return;
    await restartPackage(repo.id, pkg.name, defaultScript);
  };

  return (
    <div className='border-border/50 bg-background/50 rounded-md border'>
      <div className='flex items-center justify-between px-3 py-2'>
        <div className='flex items-center gap-2 overflow-hidden'>
          <Package className='text-muted-foreground h-3.5 w-3.5 flex-shrink-0' />
          <span className='truncate text-sm font-medium'>{pkg.name}</span>
          {pkg.version && <span className='text-muted-foreground text-xs'>v{pkg.version}</span>}
          {running && (
            <Badge
              variant='outline'
              className='border-green-800/50 bg-green-900/30 px-1.5 py-0 text-[10px] text-green-400'
            >
              <span className='mr-1 h-1.5 w-1.5 rounded-full bg-green-400' />
              Running
            </Badge>
          )}
        </div>
        <div className='flex items-center gap-0.5'>
          <TooltipProvider delayDuration={300}>
            {running ?
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon-xs' onClick={handleRestart}>
                      <RotateCcw className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon-xs'
                      onClick={handleStop}
                      className='hover:bg-destructive/20 hover:text-destructive-foreground'
                    >
                      <Square className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop</TooltipContent>
                </Tooltip>
              </>
            : <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={handleStart}
                    disabled={!defaultScript}
                    className='hover:bg-green-900/30 hover:text-green-400'
                  >
                    <Play className='h-3.5 w-3.5' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {defaultScript ? `Run: ${defaultScript}` : 'No scripts available'}
                </TooltipContent>
              </Tooltip>
            }
          </TooltipProvider>
        </div>
      </div>
      {(running || showTerminal) && terminalData[compositeKey] && (
        <div className='border-border/50 border-t px-2 pt-1 pb-2'>
          <TerminalOutput repoId={compositeKey} data={terminalData[compositeKey] || ''} />
        </div>
      )}
    </div>
  );
}

export function WorkspacePackageList({ repo }: { repo: Repository }) {
  if (!repo.workspace) return null;

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        <span>{repo.workspace.packages.length} packages</span>
        {repo.workspace.hasTurbo && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant='outline'
                  className='border-cyan-800/50 bg-cyan-900/20 px-1.5 py-0 text-[10px] text-cyan-400'
                >
                  Turborepo
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Uses Turborepo for optimized builds</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span>{repo.workspace.packageManager}</span>
      </div>
      {repo.workspace.packages.map(pkg => (
        <PackageItem key={pkg.name} repo={repo} pkg={pkg} />
      ))}
    </div>
  );
}
