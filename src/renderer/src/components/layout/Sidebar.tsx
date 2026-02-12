import { NavLink, useLocation } from 'react-router-dom';
import {
  FolderGit2,
  Network,
  Settings,
  GitPullRequest,
  Search,
  Package,
  Bot,
  Sparkles,
} from 'lucide-react';
import { usePortStore } from '@/store/portStore';

const navItems = [
  { to: '/', icon: FolderGit2, label: 'Repositories' },
  { to: '/github', icon: GitPullRequest, label: 'Pull Requests' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/skills', icon: Sparkles, label: 'Skills' },
  { to: '/packages', icon: Package, label: 'Packages' },
  { to: '/ports', icon: Network, label: 'Ports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();
  const isRepoDetail = location.pathname.startsWith('/repo/');
  const portCount = usePortStore(s => s.ports.length);

  return (
    <aside className='border-border bg-sidebar flex h-full w-56 flex-col border-r pt-12'>
      <div className='px-4 pb-4'>
        <h1 className='text-primary text-lg font-semibold'>RepoHub</h1>
      </div>
      <nav className='flex flex-col gap-1 px-2'>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => {
              const active = isActive || (to === '/' && isRepoDetail);
              return `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ?
                  'bg-sidebar-accent text-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`;
            }}
          >
            <Icon className='h-4 w-4' />
            <span className='flex-1'>{label}</span>
            {to === '/ports' && portCount > 0 && (
              <span className='bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium tabular-nums'>
                {portCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
