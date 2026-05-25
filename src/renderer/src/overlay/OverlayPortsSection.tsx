import { usePortStore } from '@/store/portStore';
import { ChevronRight, ExternalLink, Network, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { SectionHeader } from './SectionHeader';

export function OverlayPortsSection() {
  const ports = usePortStore(s => s.ports);
  const [menu, setMenu] = useState<{ port: number; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  if (ports.length === 0) return null;

  const displayed = ports.slice(0, 5);

  function openMenu(e: React.MouseEvent, port: number) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ port, x: rect.left, y: rect.bottom + 4 });
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
          onClick={e => openMenu(e, port.port)}
          className='hover:bg-secondary/50 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors'
        >
          <Network className='text-muted-foreground h-3 w-3 shrink-0' />
          <span className='text-xs font-medium tabular-nums'>{port.port}</span>
          <span className='text-muted-foreground flex-1 truncate text-xs'>
            {port.description || port.command}
          </span>
        </button>
      ))}
      {ports.length > 5 && (
        <button
          onClick={() => window.electron.overlay.expandToDashboard('/ports')}
          className='text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 rounded-lg py-1 text-xs transition-colors'
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
            className='border-border bg-popover fixed z-50 min-w-35 rounded-md border p-1 shadow-md'
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              onClick={() => {
                window.electron.shell.openUrl(`http://localhost:${menu.port}`);
                setMenu(null);
              }}
              className='text-foreground hover:bg-secondary flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors'
            >
              <ExternalLink className='h-3 w-3' />
              Open in Browser
            </button>
            <button
              onClick={async () => {
                await window.electron.ports.killByPort(menu.port);
                setMenu(null);
              }}
              className='text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors'
            >
              <X className='h-3 w-3' />
              Kill :{menu.port}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
