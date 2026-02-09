import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RepositoriesView } from '@/views/RepositoriesView'
import { PortsView } from '@/views/PortsView'
import { SettingsView } from '@/views/SettingsView'
import { GitHubView } from '@/views/GitHubView'
import { useProcessListeners } from '@/hooks/useProcesses'
import { useHealthListeners } from '@/hooks/useHealth'
import { useGitHubListeners } from '@/hooks/useGitHub'

export default function App() {
  useProcessListeners()
  useHealthListeners()
  useGitHubListeners()

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RepositoriesView />} />
          <Route path="/github" element={<GitHubView />} />
          <Route path="/ports" element={<PortsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
