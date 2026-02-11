import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onLaunch: () => void;
}

export function EmptyState({ onLaunch }: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center gap-4 py-20 text-center'>
      <Bot className='text-muted-foreground/40 h-16 w-16' />
      <div>
        <h3 className='text-lg font-medium'>No agents running</h3>
        <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
          Launch a Claude Code agent to perform coding tasks, review code, or research your
          repositories.
        </p>
      </div>
      <Button onClick={onLaunch}>
        <Bot className='h-4 w-4' />
        Launch Agent
      </Button>
    </div>
  );
}
