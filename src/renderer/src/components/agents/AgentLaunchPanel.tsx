import { useState, useMemo } from 'react';
import {
  Bot,
  Code,
  Eye,
  Search,
  AlertTriangle,
  ArrowLeft,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useRepositoryStore } from '@/store/repositoryStore';
import type { AgentLaunchConfig, Repository } from '@/types';

const ROLES = [
  {
    id: 'coder',
    name: 'Coder',
    icon: Code,
    description: 'Full coding agent. Reads, writes, executes code.',
    iconColor: 'text-green-400',
    inactive: 'border-border hover:border-green-500/60',
    active: 'bg-green-500/10 border-green-500/60',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    icon: Eye,
    description: 'Read-only. Reviews code quality and finds bugs.',
    iconColor: 'text-blue-400',
    inactive: 'border-border hover:border-blue-500/60',
    active: 'bg-blue-500/10 border-blue-500/60',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    icon: Search,
    description: 'Read-only. Explores codebase and answers questions.',
    iconColor: 'text-purple-400',
    inactive: 'border-border hover:border-purple-500/60',
    active: 'bg-purple-500/10 border-purple-500/60',
  },
];

interface AgentLaunchPanelProps {
  onLaunch: (config: AgentLaunchConfig) => void;
  onCancel: () => void;
}

export function AgentLaunchPanel({ onLaunch, onCancel }: AgentLaunchPanelProps) {
  const repositories = useRepositoryStore(s => s.repositories);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('coder');
  const [task, setTask] = useState('');
  const [autonomous, setAutonomous] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');
  const [launching, setLaunching] = useState(false);

  const filteredRepos = useMemo(() => {
    const sorted = [...repositories].sort((a, b) => a.name.localeCompare(b.name));
    if (!repoFilter.trim()) return sorted;
    const lower = repoFilter.toLowerCase();
    return sorted.filter(r => r.name.toLowerCase().includes(lower));
  }, [repositories, repoFilter]);

  const canLaunch = selectedRepo && task.trim() && !launching;

  const handleLaunch = async () => {
    if (!canLaunch || !selectedRepo) return;
    setLaunching(true);
    try {
      onLaunch({
        repoId: selectedRepo.id,
        repoPath: selectedRepo.path,
        repoName: selectedRepo.name,
        roleId: selectedRoleId,
        task: task.trim(),
        autonomous,
      });
    } catch {
      setLaunching(false);
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='sm' onClick={onCancel}>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <Bot className='h-5 w-5' />
        <h3 className='text-lg font-semibold'>Launch Agent</h3>
      </div>

      {/* Repository picker */}
      <div>
        <label className='text-muted-foreground mb-2 block text-sm font-medium'>Repository</label>
        {selectedRepo ? (
          <div className='flex items-center gap-2'>
            <Badge variant='secondary' className='gap-1'>
              {selectedRepo.name}
              <span className='text-muted-foreground capitalize'>({selectedRepo.projectType})</span>
            </Badge>
            <Button
              variant='ghost'
              size='sm'
              className='h-6 text-xs'
              onClick={() => setSelectedRepo(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className='flex flex-col gap-2'>
            <Input
              placeholder='Filter repositories...'
              value={repoFilter}
              onChange={e => setRepoFilter(e.target.value)}
              className='h-8'
            />
            <div className='flex max-h-48 flex-col gap-1 overflow-y-auto'>
              {filteredRepos.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className='bg-secondary/30 hover:bg-secondary flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors'
                >
                  <span className='truncate font-medium'>{repo.name}</span>
                  <span className='text-muted-foreground text-xs capitalize'>
                    {repo.projectType}
                  </span>
                  {repo.gitBranch && (
                    <span className='text-muted-foreground ml-auto shrink-0 text-xs'>
                      {repo.gitBranch}
                    </span>
                  )}
                </button>
              ))}
              {filteredRepos.length === 0 && (
                <span className='text-muted-foreground px-3 py-2 text-sm'>No repositories found</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Role picker */}
      <div>
        <label className='text-muted-foreground mb-2 block text-sm font-medium'>Role</label>
        <div className='grid grid-cols-3 gap-3'>
          {ROLES.map(role => {
            const Icon = role.icon;
            const isActive = selectedRoleId === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  isActive ? role.active : role.inactive
                }`}
              >
                <Icon className={`mb-1 h-5 w-5 ${role.iconColor}`} />
                <div className='text-sm font-medium'>{role.name}</div>
                <div className='text-muted-foreground mt-0.5 text-xs'>{role.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task input */}
      <div>
        <label className='text-muted-foreground mb-2 block text-sm font-medium'>Task</label>
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder='Describe what the agent should do...'
          rows={3}
          className='border-border bg-secondary/30 text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500/50'
        />
      </div>

      {/* Mode toggle */}
      <div className='flex items-center gap-3'>
        <label className='flex cursor-pointer items-center gap-2'>
          <input
            type='checkbox'
            checked={autonomous}
            onChange={e => setAutonomous(e.target.checked)}
            className='accent-primary h-4 w-4 rounded'
          />
          <span className='text-sm'>Autonomous mode</span>
        </label>
        {autonomous && (
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className='h-4 w-4 text-amber-400' />
            </TooltipTrigger>
            <TooltipContent>
              Agent will auto-approve all tool calls without asking. Use with caution.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Launch button */}
      <div className='flex items-center gap-2'>
        <Button onClick={handleLaunch} disabled={!canLaunch} className='gap-2'>
          <Rocket className='h-4 w-4' />
          {launching ? 'Launching...' : 'Launch Agent'}
        </Button>
        <Button variant='ghost' onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
