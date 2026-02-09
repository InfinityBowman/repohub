import { Shield, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useHealth } from '@/hooks/useHealth'
import { HealthDetailPopover } from './HealthDetailPopover'
import type { HealthStatus } from '@/types'

const statusStyles: Record<HealthStatus, string> = {
  green: 'border-green-800/50 bg-green-900/30 text-green-400',
  yellow: 'border-yellow-800/50 bg-yellow-900/30 text-yellow-400',
  red: 'border-red-800/50 bg-red-900/30 text-red-400',
  unknown: 'border-border bg-secondary text-muted-foreground',
}

export function HealthBadge({ repoId }: { repoId: string }) {
  const { getHealthStatus, isChecking, checkHealth } = useHealth()
  const health = getHealthStatus(repoId)
  const checking = isChecking(repoId)

  const statusTooltip: Record<HealthStatus, string> = {
    green: 'Dependencies: Healthy',
    yellow: 'Dependencies: Warnings found',
    red: 'Dependencies: Vulnerabilities found',
    unknown: 'Check dependency health',
  }

  if (checking) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 border-border bg-secondary text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Checking dependencies…</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (!health) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="cursor-pointer gap-1 border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
              onClick={(e) => {
                e.stopPropagation()
                checkHealth(repoId)
              }}
            >
              <Shield className="h-3 w-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Check dependency health</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HealthDetailPopover repoId={repoId} health={health}>
            <Badge
              variant="outline"
              className={`cursor-pointer gap-1 ${statusStyles[health.status]}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Shield className="h-3 w-3" />
            </Badge>
          </HealthDetailPopover>
        </TooltipTrigger>
        <TooltipContent>{statusTooltip[health.status]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
