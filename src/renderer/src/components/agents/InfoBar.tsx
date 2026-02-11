import { useState, useEffect } from 'react';
import { Square, Code, Eye, Search, DollarSign, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
    <div className='flex shrink-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant='outline' className='gap-1 capitalize'>
            <RoleIcon className='h-3 w-3' />
            {agent.config.roleId}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Agent role</TooltipContent>
      </Tooltip>

      <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
        {agent.config.task}
      </span>

      <Badge variant='secondary' className={stateInfo.color}>
        {agent.state === 'working' && (
          <span className='mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current' />
        )}
        {stateInfo.label}
      </Badge>

      <span className='text-muted-foreground flex items-center gap-1 font-mono text-xs'>
        <Clock className='h-3 w-3' />
        {elapsed}
      </span>

      {agent.cost.totalCost > 0 && (
        <Tooltip>
          <TooltipTrigger>
            <span className='flex items-center gap-1 text-xs text-green-400'>
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
            <button
              onClick={onStop}
              className='text-muted-foreground hover:text-red-400 rounded p-1 transition-colors'
            >
              <Square className='h-3.5 w-3.5' />
            </button>
          </TooltipTrigger>
          <TooltipContent>Stop agent</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
