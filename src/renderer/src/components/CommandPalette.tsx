import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScaffoldDialog } from '@/components/scaffold/ScaffoldDialog';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useRepositoryStore } from '@/store/repositoryStore';
import { useProcessStore } from '@/store/processStore';
import { useGitHubStore } from '@/store/githubStore';
import type { Repository, WorkspacePackage } from '@/types';
import {
  ArrowLeft,
  Code,
  ExternalLink,
  FolderSearch,
  GitBranch,
  GitPullRequest,
  Globe,
  HeartPulse,
  LayoutDashboard,
  Package,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Square,
} from 'lucide-react';
import { VSCodeIcon } from '@/components/icons/VSCodeIcon';
import { GhosttyIcon } from '@/components/icons/GhosttyIcon';
import { LanguageIcon } from '@/components/icons/LanguageIcon';
import type { ProjectType } from '@/types';

function getDefaultScript(pkg: WorkspacePackage): string | null {
  if (pkg.scripts.dev) return 'dev';
  if (pkg.scripts.start) return 'start';
  const keys = Object.keys(pkg.scripts);
  return keys.length > 0 ? keys[0] : null;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [search, setSearch] = useState('');
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const navigate = useNavigate();

  const repositories = useRepositoryStore(s => s.repositories);
  const processes = useProcessStore(s => s.processes);
  const githubStatus = useGitHubStore(s => s.status);
  const prsByRepo = useGitHubStore(s => s.prsByRepo);

  // Cmd+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && e.metaKey) {
        e.preventDefault();
        setOpen(prev => {
          if (prev) {
            setSelectedRepo(null);
            setSearch('');
          }
          return !prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectRepo = useCallback((repo: Repository | null) => {
    setSelectedRepo(repo);
    setSearch('');
  }, []);

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (!value) {
      setSelectedRepo(null);
      setSearch('');
    }
  }, []);

  const handleEscapeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (selectedRepo) {
        event.preventDefault();
        selectRepo(null);
      }
    },
    [selectedRepo, selectRepo],
  );

  const closeAndRun = useCallback((fn: () => void) => {
    setOpen(false);
    setSelectedRepo(null);
    setSearch('');
    fn();
  }, []);

  const isRunning = (repoId: string) => {
    return processes[repoId]?.status === 'running';
  };

  const isPackageRunning = (repoId: string, packageName: string) => {
    return processes[`${repoId}:${packageName}`]?.status === 'running';
  };

  const isOnFeatureBranch = (repo: Repository) => {
    return repo.gitBranch && repo.gitBranch !== 'main' && repo.gitBranch !== 'master';
  };

  const hasExistingPR = (repoId: string) => {
    return !!prsByRepo[repoId];
  };

  const hasWorkspace = (repo: Repository) => {
    return repo.projectType === 'monorepo' && repo.workspace;
  };

  const hasRunningPkgs = (repo: Repository) => {
    return (
      hasWorkspace(repo) &&
      repo.workspace!.packages.some(pkg => isPackageRunning(repo.id, pkg.name))
    );
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        onEscapeKeyDown={handleEscapeKeyDown}
        showCloseButton={false}
      >
        {/* Repo actions: breadcrumb header */}
        {selectedRepo && (
          <div className='flex items-center gap-2 border-b px-3 py-2'>
            <button
              onClick={() => selectRepo(null)}
              className='text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors'
            >
              <ArrowLeft className='size-4' />
            </button>
            <span className='text-sm font-medium'>{selectedRepo.name}</span>
            {selectedRepo.projectType !== 'unknown' && (
              <LanguageIcon type={selectedRepo.projectType} className='h-4 w-4' />
            )}
          </div>
        )}

        <CommandInput
          placeholder={selectedRepo ? 'Search actions...' : 'Search repositories and commands...'}
          value={search}
          onValueChange={setSearch}
        />

        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* ---- ROOT LEVEL ---- */}
          {!selectedRepo && (
            <>
              <CommandGroup heading='Repositories'>
                {repositories.map(repo => (
                  <CommandItem
                    key={repo.id}
                    value={`repo:${repo.name}`}
                    onSelect={() => selectRepo(repo)}
                  >
                    <Code className='mr-2' />
                    <span className='flex-1'>{repo.name}</span>
                    {repo.projectType !== 'unknown' && (
                      <LanguageIcon type={repo.projectType} className='h-4 w-4' />
                    )}
                    {(isRunning(repo.id) || hasRunningPkgs(repo)) && (
                      <span className='ml-1 h-2 w-2 rounded-full bg-green-500' />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading='Commands'>
                <CommandItem onSelect={() => closeAndRun(() => setScaffoldOpen(true))}>
                  <Plus className='mr-2' />
                  New Project
                </CommandItem>
                <CommandItem onSelect={() => closeAndRun(() => navigate('/'))}>
                  <LayoutDashboard className='mr-2' />
                  Dashboard
                </CommandItem>
                <CommandItem onSelect={() => closeAndRun(() => navigate('/github'))}>
                  <GitPullRequest className='mr-2' />
                  GitHub PRs
                </CommandItem>
                <CommandItem onSelect={() => closeAndRun(() => navigate('/search'))}>
                  <Search className='mr-2' />
                  Code Search
                </CommandItem>
                <CommandItem onSelect={() => closeAndRun(() => navigate('/ports'))}>
                  <Globe className='mr-2' />
                  Port Monitor
                </CommandItem>
                <CommandItem onSelect={() => closeAndRun(() => navigate('/settings'))}>
                  <Settings className='mr-2' />
                  Settings
                </CommandItem>

                <CommandSeparator />

                <CommandItem
                  onSelect={() => closeAndRun(() => window.electron.repositories.rescan())}
                >
                  <FolderSearch className='mr-2' />
                  Scan Repositories
                </CommandItem>
                <CommandItem onSelect={() => closeAndRun(() => window.electron.github.refresh())}>
                  <RefreshCw className='mr-2' />
                  Refresh GitHub
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    closeAndRun(() => {
                      const repoIds = repositories
                        .filter(r => r.projectType === 'node' || r.projectType === 'monorepo')
                        .map(r => r.id);
                      if (repoIds.length > 0) {
                        window.electron.health.checkAll(repoIds);
                      }
                    })
                  }
                >
                  <HeartPulse className='mr-2' />
                  Check All Dependencies
                </CommandItem>
              </CommandGroup>
            </>
          )}

          {/* ---- REPO ACTIONS LEVEL ---- */}
          {selectedRepo && (
            <>
              <CommandGroup heading='Open'>
                <CommandItem
                  onSelect={() =>
                    closeAndRun(() => window.electron.shell.openInVSCode(selectedRepo.path))
                  }
                >
                  <VSCodeIcon className='mr-2 h-4 w-4' />
                  Open in VS Code
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    closeAndRun(() => window.electron.shell.openInTerminal(selectedRepo.path))
                  }
                >
                  <GhosttyIcon className='mr-2 h-4 w-4' />
                  Open in Ghostty
                </CommandItem>
                {selectedRepo.githubUrl && (
                  <CommandItem
                    onSelect={() =>
                      closeAndRun(() => window.electron.shell.openUrl(selectedRepo.githubUrl!))
                    }
                  >
                    <ExternalLink className='mr-2' />
                    Open on GitHub
                  </CommandItem>
                )}
              </CommandGroup>

              {/* Root process controls — same for all repo types */}
              <CommandSeparator />
              <CommandGroup heading='Process'>
                {!isRunning(selectedRepo.id) && selectedRepo.defaultCommand && (
                  <CommandItem
                    onSelect={() =>
                      closeAndRun(() => window.electron.processes.start(selectedRepo.id))
                    }
                  >
                    <Play className='mr-2' />
                    Start
                    <CommandShortcut>{selectedRepo.defaultCommand}</CommandShortcut>
                  </CommandItem>
                )}
                {isRunning(selectedRepo.id) && (
                  <>
                    <CommandItem
                      onSelect={() =>
                        closeAndRun(() => window.electron.processes.stop(selectedRepo.id))
                      }
                    >
                      <Square className='mr-2' />
                      Stop
                    </CommandItem>
                    <CommandItem
                      onSelect={() =>
                        closeAndRun(() => window.electron.processes.restart(selectedRepo.id))
                      }
                    >
                      <RefreshCw className='mr-2' />
                      Restart
                    </CommandItem>
                  </>
                )}
              </CommandGroup>

              {/* Monorepo: additional per-package controls */}
              {hasWorkspace(selectedRepo) && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading='Packages'>
                    {selectedRepo.workspace!.packages.map(pkg => {
                      const running = isPackageRunning(selectedRepo.id, pkg.name);
                      const defaultScript = getDefaultScript(pkg);

                      if (running) {
                        return (
                          <CommandItem
                            key={`${pkg.name}:stop`}
                            value={`pkg:${pkg.name} stop`}
                            onSelect={() =>
                              closeAndRun(() =>
                                window.electron.processes.stopPackage(selectedRepo.id, pkg.name),
                              )
                            }
                          >
                            <Square className='mr-2 text-red-500' />
                            <span className='flex-1'>
                              Stop <span className='text-muted-foreground'>{pkg.name}</span>
                            </span>
                            <span className='ml-1 h-2 w-2 rounded-full bg-green-500' />
                          </CommandItem>
                        );
                      }

                      if (defaultScript) {
                        return (
                          <CommandItem
                            key={`${pkg.name}:start`}
                            value={`pkg:${pkg.name} start`}
                            onSelect={() =>
                              closeAndRun(() =>
                                window.electron.processes.startPackage(
                                  selectedRepo.id,
                                  pkg.name,
                                  defaultScript,
                                ),
                              )
                            }
                          >
                            <Play className='mr-2 text-green-500' />
                            <span className='flex-1'>
                              Start <span className='text-muted-foreground'>{pkg.name}</span>
                            </span>
                            <CommandShortcut>{defaultScript}</CommandShortcut>
                          </CommandItem>
                        );
                      }

                      return (
                        <CommandItem key={pkg.name} value={`pkg:${pkg.name}`} disabled>
                          <Package className='mr-2' />
                          <span className='flex-1'>
                            {pkg.name}{' '}
                            <span className='text-muted-foreground text-xs'>no scripts</span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}

              {(selectedRepo.projectType === 'node' || selectedRepo.projectType === 'monorepo') && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading='Dependencies'>
                    <CommandItem
                      onSelect={() =>
                        closeAndRun(() => window.electron.health.check(selectedRepo.id))
                      }
                    >
                      <HeartPulse className='mr-2' />
                      Check Dependencies
                    </CommandItem>
                  </CommandGroup>
                </>
              )}

              {githubStatus?.available &&
                isOnFeatureBranch(selectedRepo) &&
                !hasExistingPR(selectedRepo.id) && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading='GitHub'>
                      <CommandItem
                        onSelect={() =>
                          closeAndRun(() => window.electron.github.createPR(selectedRepo.id))
                        }
                      >
                        <GitPullRequest className='mr-2' />
                        Create Pull Request
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

              {selectedRepo.gitBranch && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading='Git'>
                    <CommandItem
                      onSelect={() => closeAndRun(() => navigate(`/repo/${selectedRepo.id}`))}
                    >
                      <GitBranch className='mr-2' />
                      Clean Branches
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>

        <div className='border-t px-3 py-2'>
          <span className='text-muted-foreground text-xs'>
            {selectedRepo ?
              <>
                <kbd className='bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium'>Esc</kbd> to
                go back
              </>
            : <>
                <kbd className='bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium'>⌘K</kbd> to
                toggle
              </>
            }
          </span>
        </div>
      </CommandDialog>

      <ScaffoldDialog open={scaffoldOpen} onOpenChange={setScaffoldOpen} />
    </>
  );
}
