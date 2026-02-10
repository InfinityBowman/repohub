import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  SquareTerminal,
  GitBranch,
  Github,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FileJson,
} from 'lucide-react'
import { VSCodeIcon } from '@/components/icons/VSCodeIcon'
import { useRepositoryStore } from '@/store/repositoryStore'
import { useProcesses } from '@/hooks/useProcesses'
import { useConfig } from '@/hooks/useConfig'
import { useGitHub } from '@/hooks/useGitHub'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ProjectBadge } from '@/components/repository/ProjectBadge'
import { HealthBadge } from '@/components/repository/HealthBadge'
import { PRBadge } from '@/components/github/PRBadge'
import { CreatePRButton } from '@/components/github/CreatePRButton'
import { TerminalOutput } from '@/components/process/TerminalOutput'
import { WorkspacePackageList } from '@/components/repository/WorkspacePackageList'
import { BranchCleanup } from '@/components/repository/BranchCleanup'

export function RepositoryDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const repositories = useRepositoryStore((s) => s.repositories)
  const repo = repositories.find((r) => r.id === id)

  const { processes, start, stop, restart, isRunning, terminalData } = useProcesses()
  const { config, setCommandOverride, removeCommandOverride } = useConfig()
  const { getPRForRepo, status: githubStatus } = useGitHub()

  const [editingCmd, setEditingCmd] = useState(false)
  const [cmdDraft, setCmdDraft] = useState('')
  const [packageJson, setPackageJson] = useState<string | null>(null)
  const [packageJsonError, setPackageJsonError] = useState(false)
  const [showPackageJson, setShowPackageJson] = useState(false)
  const [showBranches, setShowBranches] = useState(false)

  const pr = repo ? getPRForRepo(repo.id) : null
  const running = repo ? isRunning(repo.id) : false
  const processInfo = repo ? processes[repo.id] : undefined
  const commandOverride = repo ? config?.commandOverrides?.[repo.id] : undefined
  const effectiveCommand = repo ? commandOverride || repo.defaultCommand : null

  // Load package.json on mount
  useEffect(() => {
    if (!id) return
    window.electron.repositories.readFile(id, 'package.json').then((result) => {
      if (typeof result === 'string' && !result.startsWith('{') && (result as any).error) {
        setPackageJsonError(true)
      } else if (typeof result === 'object' && (result as any).error) {
        setPackageJsonError(true)
      } else {
        setPackageJson(result as string)
      }
    })
  }, [id])

  if (!repo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Repository not found</p>
          <Button variant="ghost" className="mt-2" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const displayName = repo.name.includes('/') ? repo.name.split('/').pop() : repo.name

  const handleStart = async () => {
    await start(repo.id)
  }

  const handleStop = async () => {
    await stop(repo.id)
  }

  const handleRestart = async () => {
    await restart(repo.id)
  }

  const startEditCmd = () => {
    setCmdDraft(commandOverride || repo.defaultCommand || '')
    setEditingCmd(true)
  }

  const saveCmd = async () => {
    const trimmed = cmdDraft.trim()
    if (trimmed && trimmed !== repo.defaultCommand) {
      await setCommandOverride(repo.id, trimmed)
    } else {
      await removeCommandOverride(repo.id)
    }
    setEditingCmd(false)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <Button variant="ghost" size="icon-xs" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold">{displayName}</h1>
                <ProjectBadge type={repo.projectType} />
                {(repo.projectType === 'node' || repo.projectType === 'monorepo') && (
                  <HealthBadge repoId={repo.id} />
                )}
                {repo.projectType === 'monorepo' && repo.workspace && (
                  <Badge variant="outline" className="border-purple-800/50 bg-purple-900/20 text-purple-400">
                    {repo.workspace.packages.length} pkgs
                  </Badge>
                )}
                {repo.gitBranch && (
                  <Badge variant="outline" className="gap-1 border-blue-800/50 bg-blue-900/20 text-blue-400">
                    <GitBranch className="h-3 w-3" />
                    {repo.gitBranch}
                    {repo.gitDirty && (
                      <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                    )}
                  </Badge>
                )}
                {pr && <PRBadge pr={pr} />}
                {running && (
                  <Badge variant="outline" className="border-green-800/50 bg-green-900/30 text-green-400">
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-400" />
                    Running
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{repo.path}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => window.electron.shell.openInVSCode(repo.path)}
                  >
                    <VSCodeIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open in VS Code</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => window.electron.shell.openInTerminal(repo.path)}
                  >
                    <SquareTerminal />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open in Ghostty</TooltipContent>
              </Tooltip>
              {repo.githubUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => window.electron.shell.openUrl(repo.githubUrl!)}
                    >
                      <Github />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open on GitHub</TooltipContent>
                </Tooltip>
              )}
              {!pr && repo.gitBranch && repo.gitBranch !== 'main' && repo.gitBranch !== 'master' && githubStatus?.available && githubStatus?.authenticated && (
                <CreatePRButton repoId={repo.id} />
              )}
              {running ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" onClick={handleRestart}>
                        <RotateCcw />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Restart</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleStop}
                        className="hover:bg-destructive/20 hover:text-destructive-foreground"
                      >
                        <Square />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleStart}
                      disabled={!effectiveCommand}
                      className="hover:bg-green-900/30 hover:text-green-400"
                    >
                      <Play />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {effectiveCommand ? `Run: ${effectiveCommand}` : 'No run command detected'}
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-6 p-6">
        {/* Process Section */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Process</h2>
          <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
            {processInfo && processInfo.status === 'running' ? (
              <>
                <span>PID: {processInfo.pid}</span>
                <span>Cmd: {processInfo.command}</span>
              </>
            ) : editingCmd ? (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Cmd:</span>
                <Input
                  value={cmdDraft}
                  onChange={(e) => setCmdDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCmd()
                    if (e.key === 'Escape') setEditingCmd(false)
                  }}
                  className="h-6 w-56 text-xs"
                  autoFocus
                />
                <Button variant="ghost" size="icon-xs" onClick={saveCmd}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setEditingCmd(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span>
                  Cmd: {effectiveCommand || 'none'}
                  {commandOverride && <span className="ml-1 text-blue-400">(custom)</span>}
                </span>
                <Button variant="ghost" size="icon-xs" onClick={startEditCmd}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
          <TerminalOutput repoId={repo.id} data={terminalData[repo.id] || ''} />
        </section>

        {/* Workspace Packages (monorepo only) */}
        {repo.projectType === 'monorepo' && repo.workspace && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Packages</h2>
            <WorkspacePackageList repo={repo} />
          </section>
        )}

        {/* package.json Preview */}
        {packageJson && !packageJsonError && (
          <section>
            <button
              className="mb-3 flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowPackageJson(!showPackageJson)}
            >
              {showPackageJson ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <FileJson className="h-4 w-4" />
              package.json
            </button>
            {showPackageJson && (
              <pre className="max-h-96 overflow-auto rounded-md border border-border bg-[#0a0a0a] p-4 text-xs text-muted-foreground font-mono">
                {packageJson}
              </pre>
            )}
          </section>
        )}

        {/* Branch Cleanup */}
        {repo.gitBranch && (
          <section>
            <button
              className="mb-3 flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowBranches(!showBranches)}
            >
              {showBranches ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <GitBranch className="h-4 w-4" />
              Branch Cleanup
            </button>
            {showBranches && <BranchCleanup repoId={repo.id} />}
          </section>
        )}
      </div>
    </div>
  )
}
