import { usePortStore } from '@/store/portStore';
import { ChevronRight, Network } from 'lucide-react';
import { useRef, useState } from 'react';
import { SectionHeader } from './SectionHeader';

export function OverlayPortsSection() {
  const ports = usePortStore(s => s.ports);
  const [menu, setMenu] = useState<{ port: number; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  if (ports.length === 0) return null;

  const displayed = ports.slice(0, 5);

  function handleContextMenu(e: React.MouseEvent, port: number) {
    e.preventDefault();
    setMenu({ port, x: e.clientX, y: e.clientY });
  }

  async function handleKill() {
    if (!menu) return;
    await window.electron.ports.killByPort(menu.port);
    setMenu(null);
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <SectionHeader
        label='PORTS'
        count={ports.length}
        onExpand={() => window.electron.overlay.expandToDashboard('/ports')}
      />
      {displayed.map(port => (
        <button
          key={port.port}
          onClick={() => window.electron.shell.openUrl(`http://localhost:${port.port}`)}
          onContextMenu={e => handleContextMenu(e, port.port)}
          className='flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/50'
        >
          <Network className='h-3 w-3 flex-shrink-0 text-muted-foreground' />
          <span className='text-xs font-medium tabular-nums'>{port.port}</span>
          <span className='flex-1 truncate text-xs text-muted-foreground'>
            {port.description || port.command}
          </span>
        </button>
      ))}
      {ports.length > 5 && (
        <button
          onClick={() => window.electron.overlay.expandToDashboard('/ports')}
          className='flex items-center justify-center gap-1 rounded-lg py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
        >
          +{ports.length - 5} more
          <ChevronRight className='h-3 w-3' />
        </button>
      )}

      {menu && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setMenu(null)} />
          <div
            ref={menuRef}
            className='fixed z-50 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md'
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              onClick={handleKill}
              className='flex w-full items-center rounded-sm px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10'
            >
              Kill :{menu.port}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
