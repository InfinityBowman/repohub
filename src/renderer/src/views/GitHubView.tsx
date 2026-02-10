import { RefreshCw, GitPullRequest, AlertCircle, ExternalLink } from 'lucide-react';
import { useGitHub } from '@/hooks/useGitHub';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { PRInfo, PRState, CIStatus } from '@/types';

const stateStyles: Record<PRState, string> = {
  open: 'border-green-800/50 bg-green-900/20 text-green-400',
  draft: 'border-gray-700/50 bg-gray-800/20 text-gray-400',
  merged: 'border-purple-800/50 bg-purple-900/20 text-purple-400',
  closed: 'border-red-800/50 bg-red-900/20 text-red-400',
};

const stateLabels: Record<PRState, string> = {
  open: 'Open',
  draft: 'Draft',
  merged: 'Merged',
  closed: 'Closed',
};

const ciStyles: Record<CIStatus, { label: string; className: string }> = {
  success: { label: 'Passing', className: 'border-green-800/50 bg-green-900/20 text-green-400' },
  failure: { label: 'Failing', className: 'border-red-800/50 bg-red-900/20 text-red-400' },
  pending: { label: 'Pending', className: 'border-yellow-800/50 bg-yellow-900/20 text-yellow-400' },
  unknown: { label: 'Unknown', className: 'border-border bg-secondary text-muted-foreground' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PRCard({ pr }: { pr: PRInfo }) {
  return (
    <Card className='gap-0 py-0'>
      <div className='flex items-start justify-between p-4'>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <GitPullRequest className='text-muted-foreground h-4 w-4 flex-shrink-0' />
            <span className='truncate text-sm font-medium'>{pr.title}</span>
            <Badge variant='outline' className={stateStyles[pr.state]}>
              {stateLabels[pr.state]}
            </Badge>
          </div>
          <div className='text-muted-foreground mt-1 flex items-center gap-3 text-xs'>
            <span>#{pr.number}</span>
            <span>{pr.repoFullName || pr.repoName}</span>
            <span>
              {pr.branch} → {pr.baseBranch}
            </span>
            <span>{formatDate(pr.createdAt)}</span>
          </div>
        </div>
        <div className='flex items-center gap-2 pl-3'>
          <Badge variant='outline' className={ciStyles[pr.ciStatus].className}>
            {ciStyles[pr.ciStatus].label}
          </Badge>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => window.electron.shell.openUrl(pr.url)}
                >
                  <ExternalLink className='h-3.5 w-3.5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open on GitHub</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
}

export function GitHubView() {
  const { allUserPRs, status, loading, refresh, canRefresh } = useGitHub();

  if (status && !status.available) {
    return (
      <div className='flex flex-col gap-4'>
        <h2 className='text-xl font-semibold'>Pull Requests</h2>
        <div className='flex flex-col items-center gap-3 py-12 text-center'>
          <AlertCircle className='text-muted-foreground h-8 w-8' />
          <p className='text-muted-foreground'>GitHub CLI (gh) is not installed.</p>
          <p className='text-muted-foreground text-sm'>
            Install it from{' '}
            <button
              onClick={() => window.electron.shell.openUrl('https://cli.github.com')}
              className='text-blue-400 underline'
            >
              cli.github.com
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (status && !status.authenticated) {
    return (
      <div className='flex flex-col gap-4'>
        <h2 className='text-xl font-semibold'>Pull Requests</h2>
        <div className='flex flex-col items-center gap-3 py-12 text-center'>
          <AlertCircle className='text-muted-foreground h-8 w-8' />
          <p className='text-muted-foreground'>Not authenticated with GitHub.</p>
          <p className='text-muted-foreground text-sm'>
            Run{' '}
            <code className='bg-secondary rounded px-1.5 py-0.5 font-mono text-xs'>
              gh auth login
            </code>{' '}
            in your terminal.
          </p>
        </div>
      </div>
    );
  }

  const openPRs = allUserPRs.filter(pr => pr.state === 'open' || pr.state === 'draft');

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-xl font-semibold'>Pull Requests</h2>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                onClick={refresh}
                disabled={loading || !canRefresh}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh pull requests</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className='flex flex-col gap-2'>
        {openPRs.length > 0 ?
          openPRs.map(pr => <PRCard key={`${pr.repoId}-${pr.number}`} pr={pr} />)
        : <div className='text-muted-foreground py-12 text-center'>
            {loading ? 'Loading pull requests...' : 'No open pull requests found.'}
          </div>
        }
      </div>
    </div>
  );
}
