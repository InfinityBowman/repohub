import { useState, useEffect } from 'react';
import { Square, Code, Eye, Search, DollarSign, Clock, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { AgentSessionInfo, AgentState } from '@/types';

const ROLE_ICONS: Record<string, typeof Code> = {
  coder: Code,
  reviewer: Eye,
  researcher: Search,
};

const STATE_LABELS: Record<AgentState, { label: string; color: string }> = {
  starting: { label: 'Starting', color: 'bg-yellow-500/20 text-yellow-400' },
  connected: { label: 'Connected', color: 'bg-blue-500/20 text-blue-400' },
  working: { label: 'Working', color: 'bg-green-500/20 text-green-400' },
  idle: { label: 'Idle', color: 'bg-gray-500/20 text-gray-400' },
  stopping: { label: 'Stopping', color: 'bg-orange-500/20 text-orange-400' },
  waiting_permission: { label: 'Awaiting Permission', color: 'bg-amber-500/20 text-amber-400' },
  error: { label: 'Error', color: 'bg-red-500/20 text-red-400' },
  completed: { label: 'Completed', color: 'bg-gray-500/20 text-gray-400' },
};

interface InfoBarProps {
  agent: AgentSessionInfo;
  onStop: () => void;
}

export function InfoBar({ agent, onStop }: InfoBarProps) {
  const [elapsed, setElapsed] = useState('');
  const RoleIcon = ROLE_ICONS[agent.config.roleId] || Code;
  const stateInfo = STATE_LABELS[agent.state];

  useEffect(() => {
    const update = () => {
      const endTime = agent.completedAt || Date.now();
      const seconds = Math.floor((endTime - agent.startedAt) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setElapsed(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    };

    update();
    if (agent.state !== 'completed' && agent.state !== 'error') {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [agent.startedAt, agent.completedAt, agent.state]);

  const isActive = agent.state !== 'completed' && agent.state !== 'error';

  return (
    <div className='bg-card border-border flex items-center gap-2 rounded-lg border px-3 py-2'>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant='outline' className='gap-1 capitalize'>
            <RoleIcon className='h-3 w-3' />
            {agent.config.roleId}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Agent role</TooltipContent>
      </Tooltip>

      {/* Task text — popover trigger */}
      <Popover>
        <PopoverTrigger asChild>
          <button className='text-muted-foreground hover:text-foreground min-w-0 flex-1 truncate text-left text-sm transition-colors'>
            {agent.config.task}
          </button>
        </PopoverTrigger>
        <PopoverContent align='start' className='w-80'>
          <div className='space-y-3'>
            <div>
              <p className='text-muted-foreground text-xs font-medium'>Task</p>
              <p className='mt-0.5 text-sm'>{agent.config.task}</p>
            </div>
            <div className='via-border h-px bg-gradient-to-r from-transparent to-transparent' />
            <div className='grid grid-cols-2 gap-2 text-xs'>
              <div>
                <span className='text-muted-foreground'>Repository</span>
                <div className='mt-0.5 flex items-center gap-1'>
                  <FolderGit2 className='text-muted-foreground h-3 w-3' />
                  <span className='font-medium'>{agent.config.repoName}</span>
                </div>
              </div>
              <div>
                <span className='text-muted-foreground'>Session</span>
                <p className='text-muted-foreground mt-0.5 font-mono'>{agent.id.slice(0, 8)}</p>
              </div>
              <div>
                <span className='text-muted-foreground'>Path</span>
                <p
                  className='text-muted-foreground mt-0.5 truncate font-mono'
                  title={agent.config.repoPath}
                >
                  {agent.config.repoPath}
                </p>
              </div>
              <div>
                <span className='text-muted-foreground'>Started</span>
                <p className='text-muted-foreground mt-0.5'>
                  {new Date(agent.startedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Badge variant='secondary' className={stateInfo.color}>
        {agent.state === 'working' && (
          <span className='mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current' />
        )}
        {stateInfo.label}
      </Badge>

      {/* Timer pill */}
      <Tooltip>
        <TooltipTrigger>
          <span className='flex items-center gap-1 rounded-lg bg-blue-400/[0.06] px-2.5 py-1 font-mono text-xs text-blue-400'>
            <Clock className='h-3 w-3' />
            {elapsed}
          </span>
        </TooltipTrigger>
        <TooltipContent>Elapsed time</TooltipContent>
      </Tooltip>

      {/* Cost pill */}
      {agent.cost.totalCost > 0 && (
        <Tooltip>
          <TooltipTrigger>
            <span className='flex items-center gap-1 rounded-lg bg-green-400/[0.06] px-2.5 py-1 text-xs text-green-400'>
              <DollarSign className='h-3 w-3' />
              {agent.cost.totalCost.toFixed(4)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {agent.cost.inputTokens.toLocaleString()} input /{' '}
            {agent.cost.outputTokens.toLocaleString()} output tokens
          </TooltipContent>
        </Tooltip>
      )}

      {isActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size='sm' variant='destructive' className='h-7 w-7 p-0' onClick={onStop}>
              <Square className='h-3 w-3' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop agent</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
