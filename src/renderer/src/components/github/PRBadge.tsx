import { GitPullRequest } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { PRInfo, PRState, CIStatus } from '@/types'

const stateStyles: Record<PRState, string> = {
  open: 'border-green-800/50 bg-green-900/20 text-green-400',
  draft: 'border-gray-700/50 bg-gray-800/20 text-gray-400',
  merged: 'border-purple-800/50 bg-purple-900/20 text-purple-400',
  closed: 'border-red-800/50 bg-red-900/20 text-red-400',
}

const ciDotColors: Record<CIStatus, string> = {
  success: 'bg-green-400',
  failure: 'bg-red-400',
  pending: 'bg-yellow-400',
  unknown: 'bg-gray-400',
}

export function PRBadge({ pr }: { pr: PRInfo }) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.electron.shell.openUrl(pr.url)
  }

  const ciLabels: Record<CIStatus, string> = {
    success: 'passing',
    failure: 'failing',
    pending: 'pending',
    unknown: 'unknown',
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`cursor-pointer gap-1 ${stateStyles[pr.state]}`}
            onClick={handleClick}
          >
            <GitPullRequest className="h-3 w-3" />
            #{pr.number}
            <span className={`h-1.5 w-1.5 rounded-full ${ciDotColors[pr.ciStatus]}`} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          PR #{pr.number}: {pr.title} (CI: {ciLabels[pr.ciStatus]}) — Click to open on GitHub
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
