import { NavLink, useLocation } from 'react-router-dom'
import { FolderGit2, Network, Settings, GitPullRequest } from 'lucide-react'

const navItems = [
  { to: '/', icon: FolderGit2, label: 'Repositories' },
  { to: '/github', icon: GitPullRequest, label: 'Pull Requests' },
  { to: '/ports', icon: Network, label: 'Ports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const location = useLocation()
  const isRepoDetail = location.pathname.startsWith('/repo/')

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar-background pt-12">
      <div className="px-4 pb-4">
        <h1 className="text-lg font-semibold text-foreground">RepoHub</h1>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => {
              const active = isActive || (to === '/' && isRepoDetail)
              return `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
