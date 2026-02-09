import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RepositoriesView } from '@/views/RepositoriesView'
import { PortsView } from '@/views/PortsView'
import { SettingsView } from '@/views/SettingsView'
import { useProcessListeners } from '@/hooks/useProcesses'

export default function App() {
  useProcessListeners()

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RepositoriesView />} />
          <Route path="/ports" element={<PortsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
