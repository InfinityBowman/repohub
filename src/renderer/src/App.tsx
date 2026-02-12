import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RepositoriesView } from '@/views/RepositoriesView';
import { RepositoryDetailView } from '@/views/RepositoryDetailView';
import { PortsView } from '@/views/PortsView';
import { SettingsView } from '@/views/SettingsView';
import { GitHubView } from '@/views/GitHubView';
import { CodeSearchView } from '@/views/CodeSearchView';
import { PackagesView } from '@/views/PackagesView';
import { AgentCommandCenterView } from '@/views/AgentCommandCenterView';
import { SkillsView } from '@/views/SkillsView';
import { CommandPalette } from '@/components/CommandPalette';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProcessListeners } from '@/hooks/useProcesses';
import { useHealthListeners } from '@/hooks/useHealth';
import { useGitHubListeners } from '@/hooks/useGitHub';
import { useCodeSearchListeners } from '@/hooks/useCodeSearch';
import { useAgentListeners } from '@/hooks/useAgents';

export default function App() {
  useProcessListeners();
  useHealthListeners();
  useGitHubListeners();
  useCodeSearchListeners();
  useAgentListeners();

  return (
    <TooltipProvider>
      <HashRouter>
        <CommandPalette />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path='/' element={<RepositoriesView />} />
            <Route path='/repo/:id' element={<RepositoryDetailView />} />
            <Route path='/github' element={<GitHubView />} />
            <Route path='/search' element={<CodeSearchView />} />
            <Route path='/agents' element={<AgentCommandCenterView />} />
            <Route path='/skills' element={<SkillsView />} />
            <Route path='/packages' element={<PackagesView />} />
            <Route path='/ports' element={<PortsView />} />
            <Route path='/settings' element={<SettingsView />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  );
}
