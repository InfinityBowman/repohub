import { Bot, Rocket, Code, Eye, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onLaunch: () => void;
}

const FEATURE_PILLS = [
  { label: 'Write code', icon: Code, color: 'bg-green-500/10 text-green-400' },
  { label: 'Review PRs', icon: Eye, color: 'bg-blue-500/10 text-blue-400' },
  { label: 'Research', icon: Search, color: 'bg-purple-500/10 text-purple-400' },
] as const;

export function EmptyState({ onLaunch }: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center gap-6 py-20 text-center'>
      <div className='relative rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6'>
        <Bot className='h-12 w-12 text-muted-foreground' />
        <span className='absolute right-4 bottom-4 h-2.5 w-2.5 animate-pulse rounded-full bg-green-400' />
      </div>

      <div>
        <h3 className='text-lg font-semibold'>Launch Your First Agent</h3>
        <p className='text-muted-foreground mt-1.5 max-w-sm text-sm'>
          Spin up a Claude Code agent to work on your repositories — writing code, reviewing
          changes, or researching solutions autonomously.
        </p>
      </div>

      <div className='flex gap-2'>
        {FEATURE_PILLS.map(({ label, icon: Icon, color }) => (
          <span
            key={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${color}`}
          >
            <Icon className='h-3 w-3' />
            {label}
          </span>
        ))}
      </div>

      <Button onClick={onLaunch}>
        <Rocket className='h-4 w-4' />
        Launch Agent
      </Button>
    </div>
  );
}
