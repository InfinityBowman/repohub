import { useOverlayCommitsStore } from '@/store/overlayCommitsStore';
import { SectionHeader } from './SectionHeader';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function OverlayCommitsSection() {
  const commits = useOverlayCommitsStore(s => s.commits);

  if (commits.length === 0) return null;

  const displayed = commits.slice(0, 5);

  return (
    <div className='flex flex-col gap-1.5'>
      <SectionHeader label='COMMITS' />
      {displayed.map(commit => (
        <button
          key={`${commit.repoId}-${commit.hash}`}
          onClick={() =>
            window.electron.overlay.expandToDashboard(`/repo/${commit.repoId}`)
          }
          className='flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/50'
        >
          <span className='truncate text-xs'>{commit.subject}</span>
          <div className='flex items-center gap-1.5 text-[10px] text-muted-foreground'>
            <span className='truncate'>{commit.repoName}</span>
            <span className='font-mono'>{commit.shortHash}</span>
            <span className='ml-auto flex-shrink-0'>{timeAgo(commit.date)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
