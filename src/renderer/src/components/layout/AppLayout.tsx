import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useConfig } from '@/hooks/useConfig';

export function AppLayout() {
  const { config } = useConfig();

  useEffect(() => {
    if (config?.theme === 'palenight') {
      document.documentElement.classList.add('palenight');
    } else {
      document.documentElement.classList.remove('palenight');
    }
  }, [config?.theme]);

  // Apply color overrides
  useEffect(() => {
    const root = document.documentElement;
    const overrides = config?.colorOverrides ?? {};

    // Map of color role → CSS variables it controls
    const roleMap: Record<string, string[]> = {
      accent: ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring'],
      background: ['--background'],
      surface: ['--card', '--popover'],
      sidebar: ['--sidebar'],
      border: ['--border', '--input', '--sidebar-border'],
      text: ['--foreground', '--card-foreground', '--popover-foreground'],
    };

    // Collect all managed CSS vars for cleanup
    const allVars = Object.values(roleMap).flat();

    // Clear everything first so theme defaults come through
    for (const v of allVars) {
      root.style.removeProperty(v);
    }

    // Apply overrides
    for (const [role, vars] of Object.entries(roleMap)) {
      const color = overrides[role];
      if (color) {
        for (const v of vars) {
          root.style.setProperty(v, color);
        }
      }
    }
  }, [config?.colorOverrides, config?.theme]);

  // Apply font size
  useEffect(() => {
    const size = config?.uiFontSize;
    if (size && size !== 14) {
      document.documentElement.style.fontSize = `${size}px`;
    } else {
      document.documentElement.style.removeProperty('font-size');
    }
  }, [config?.uiFontSize]);

  return (
    <div className='flex h-screen overflow-hidden'>
      <Sidebar />
      <main className='flex flex-1 flex-col overflow-hidden'>
        <div className='drag-region h-12 flex-shrink-0' />
        <div className='flex-1 overflow-auto px-6 pb-6'>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
