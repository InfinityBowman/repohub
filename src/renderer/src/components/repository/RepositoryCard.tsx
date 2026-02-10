import {
  Play,
  Square,
  RotateCcw,
  Folder,
  GitBranch,
  Github,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { VSCodeIcon } from '../icons/VSCodeIcon'
import { GhosttyIcon } from '../icons/GhosttyIcon'
import type { Repository } from '@/types'
import { useProcesses } from '@/hooks/useProcesses'
import { useConfig } from '@/hooks/useConfig'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ProjectBadge } from './ProjectBadge'
import { HealthBadge } from './HealthBadge'
import { PRBadge } from '../github/PRBadge'
import { CreatePRButton } from '../github/CreatePRButton'
import { useGitHub } from '@/hooks/useGitHub'

export function RepositoryCard({ repo }: { repo: Repository }) {
  const navigate = useNavigate()
  const { start, stop, restart, isRunning } = useProcesses()
  const { config } = useConfig()
  const { getPRForRepo, status: githubStatus } = useGitHub()
  const pr = getPRForRepo(repo.id)

  const running = isRunning(repo.id)
  const commandOverride = config?.commandOverrides?.[repo.id]
  const effectiveCommand = commandOverride || repo.defaultCommand

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await start(repo.id)
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

  const displayName = repo.name.includes('/') ? repo.name.split('/').pop() : repo.name

  return (
    <Card className="gap-0 py-0 transition-colors hover:border-muted-foreground/30">
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => navigate(`/repo/${repo.id}`)}
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
                <Button variant="ghost" size="icon-sm" onClick={handleOpenVSCode}>
                  <VSCodeIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in VS Code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleOpenTerminal}>
                  <GhosttyIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in Ghostty</TooltipContent>
            </Tooltip>
            {repo.githubUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={handleOpenGitHub}>
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
                    <Button variant="ghost" size="icon-sm" onClick={handleRestart}>
                      <RotateCcw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" onClick={handleStop} className="hover:bg-destructive/20 hover:text-destructive-foreground">
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
                    size="icon-sm"
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
    </Card>
  )
}
