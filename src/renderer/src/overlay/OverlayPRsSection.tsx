import { useGitHubStore } from '@/store/githubStore';
import { SectionHeader } from './SectionHeader';
import { GitPullRequest } from 'lucide-react';

const stateColors: Record<string, string> = {
  open: 'text-green-400',
  draft: 'text-muted-foreground',
  merged: 'text-purple-400',
  closed: 'text-red-400',
};

export function OverlayPRsSection() {
  const allPRs = useGitHubStore(s => s.allUserPRs);
  const openPRs = allPRs.filter(pr => pr.state === 'open' || pr.state === 'draft');

  if (openPRs.length === 0) return null;

  const displayed = openPRs.slice(0, 4);

  return (
    <div className='flex flex-col gap-1.5'>
      <SectionHeader
        label='PULL REQUESTS'
        count={openPRs.length}
        onExpand={() => window.electron.overlay.expandToDashboard('/github')}
      />
      {displayed.map(pr => (
        <button
          key={pr.number}
          onClick={() => window.electron.shell.openUrl(pr.url)}
          className='flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/50'
        >
          <GitPullRequest
            className={`mt-0.5 h-3 w-3 flex-shrink-0 ${stateColors[pr.state] || 'text-muted-foreground'}`}
          />
          <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <span className='truncate text-xs'>{pr.title}</span>
            <div className='flex items-center gap-1.5 text-[10px] text-muted-foreground'>
              <span className='truncate'>{pr.repoName || pr.repoFullName}</span>
              <span>#{pr.number}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
