import { useScreenshotsStore } from '@/store/screenshotsStore';
import { SectionHeader } from './SectionHeader';

export function OverlayScreenshots() {
  const screenshots = useScreenshotsStore(s => s.screenshots);

  if (screenshots.length === 0) return null;

  return (
    <div className='flex flex-col gap-1.5'>
      <SectionHeader label='SCREENSHOTS' />
      <div className='grid grid-cols-2 gap-1.5'>
        {screenshots.slice(0, 6).map(screenshot => (
          <button
            key={screenshot.path}
            onClick={() => window.electron.shell.openUrl(`file://${screenshot.path}`)}
            onDragStart={e => {
              e.preventDefault();
              window.electron.overlay.startDrag(screenshot.path);
            }}
            draggable
            className='group relative overflow-hidden rounded-lg bg-secondary/30 transition-colors hover:bg-secondary/50'
          >
            <img
              src={`safe-file://${screenshot.path}`}
              alt={screenshot.name}
              className='pointer-events-none h-16 w-full object-cover'
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className='absolute inset-0 flex items-center justify-center bg-secondary/80 opacity-0 transition-opacity group-hover:opacity-100'>
              <span className='text-[10px] text-foreground'>Open</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
