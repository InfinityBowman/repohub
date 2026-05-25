import { type ReactNode, useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function OverlayShell({ children }: { children: ReactNode }) {
  const [buildId, setBuildId] = useState('');

  useEffect(() => {
    window.electron.app.getBuildId().then(setBuildId);
  }, []);

  return (
    <div className='flex h-screen w-[300px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-sidebar/95 backdrop-blur-md'>
      <div className='drag-region flex h-10 flex-shrink-0 items-center justify-between px-4'>
        <span className='text-xs font-semibold tracking-wide text-muted-foreground no-drag'>
          DEVSHELF
        </span>
        <button
          onClick={() => window.electron.overlay.hide()}
          className='no-drag rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'
        >
          <X className='h-3.5 w-3.5' />
        </button>
      </div>
      <div className='flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4'>
        {children}
      </div>
      {buildId && (
        <div className='flex-shrink-0 px-4 pb-2 text-center text-[9px] text-muted-foreground/50'>
          {buildId}
        </div>
      )}
    </div>
  );
}
