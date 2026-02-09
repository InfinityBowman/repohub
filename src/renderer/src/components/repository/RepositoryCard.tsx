import {
  Play,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Folder,
  SquareTerminal,
  GitBranch,
  Github,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { VSCodeIcon } from '../icons/VSCodeIcon'
import { useState } from 'react'
import type { Repository } from '@/types'
import { useProcesses } from '@/hooks/useProcesses'
import { useConfig } from '@/hooks/useConfig'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ProjectBadge } from './ProjectBadge'
import { HealthBadge } from './HealthBadge'
import { WorkspacePackageList } from './WorkspacePackageList'
import { PRBadge } from '../github/PRBadge'
import { CreatePRButton } from '../github/CreatePRButton'
import { TerminalOutput } from '../process/TerminalOutput'
import { useGitHub } from '@/hooks/useGitHub'

export function RepositoryCard({ repo }: { repo: Repository }) {
  const { processes, start, stop, restart, isRunning, terminalData } = useProcesses()
  const { config, setCommandOverride, removeCommandOverride } = useConfig()
  const { getPRForRepo, status: githubStatus } = useGitHub()
  const pr = getPRForRepo(repo.id)
  const [expanded, setExpanded] = useState(false)
  const [editingCmd, setEditingCmd] = useState(false)
  const [cmdDraft, setCmdDraft] = useState('')

  const running = isRunning(repo.id)
  const processInfo = processes[repo.id]
  const commandOverride = config?.commandOverrides?.[repo.id]
  const effectiveCommand = commandOverride || repo.defaultCommand

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const result = await start(repo.id)
    if (result.success) setExpanded(true)
  }

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await stop(repo.id)
  }

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await restart(repo.id)
  }

  const handleOpenVSCode = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.electron.shell.openInVSCode(repo.path)
  }

  const handleOpenTerminal = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.electron.shell.openInTerminal(repo.path)
  }

  const handleOpenGitHub = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (repo.githubUrl) window.electron.shell.openUrl(repo.githubUrl)
  }

  const startEditCmd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCmdDraft(commandOverride || repo.defaultCommand || '')
    setEditingCmd(true)
  }

  const saveCmd = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const trimmed = cmdDraft.trim()
    if (trimmed && trimmed !== repo.defaultCommand) {
      await setCommandOverride(repo.id, trimmed)
    } else {
      await removeCommandOverride(repo.id)
    }
    setEditingCmd(false)
  }

  const cancelEditCmd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCmd(false)
  }

  const displayName = repo.name.includes('/') ? repo.name.split('/').pop() : repo.name

  return (
    <Card className="gap-0 py-0 transition-colors hover:border-muted-foreground/30">
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
              running ? 'bg-green-900/30' : 'bg-secondary'
            }`}
          >
            <Folder className={`h-4 w-4 ${running ? 'text-green-400' : 'text-muted-foreground'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium text-card-foreground">
                {displayName}
              </h3>
              <ProjectBadge type={repo.projectType} />
              {(repo.projectType === 'node' || repo.projectType === 'monorepo') && (
                <HealthBadge repoId={repo.id} />
              )}
              {repo.projectType === 'monorepo' && repo.workspace && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="border-purple-800/50 bg-purple-900/20 text-purple-400">
                        {repo.workspace.packages.length} pkgs
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{repo.workspace.packages.length} workspace packages</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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

        <div className="no-drag flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={handleOpenVSCode}>
                  <VSCodeIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in VS Code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={handleOpenTerminal}>
                  <SquareTerminal />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in Ghostty</TooltipContent>
            </Tooltip>
            {repo.githubUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" onClick={handleOpenGitHub}>
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
                    <Button variant="ghost" size="icon-xs" onClick={handleStop} className="hover:bg-destructive/20 hover:text-destructive-foreground">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                >
                  {expanded ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{expanded ? 'Hide details' : 'Show details'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          {repo.projectType === 'monorepo' && repo.workspace ? (
            <WorkspacePackageList repo={repo} />
          ) : (
            <>
              <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
                {processInfo && processInfo.status === 'running' && (
                  <>
                    <span>PID: {processInfo.pid}</span>
                    <span>Cmd: {processInfo.command}</span>
                  </>
                )}
                {(!processInfo || processInfo.status !== 'running') && (
                  editingCmd ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-muted-foreground">Cmd:</span>
                      <Input
                        value={cmdDraft}
                        onChange={(e) => setCmdDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveCmd(e as any)
                          if (e.key === 'Escape') setEditingCmd(false)
                        }}
                        className="h-6 w-56 text-xs"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon-xs" onClick={saveCmd}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={cancelEditCmd}>
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
                  )
                )}
              </div>
              <TerminalOutput repoId={repo.id} data={terminalData[repo.id] || ''} />
            </>
          )}
        </div>
      )}
    </Card>
  )
}
