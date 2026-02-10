import type { ProjectType } from '@/types'
import { Boxes } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { LanguageIcon } from '../icons/LanguageIcon'

const typeLabels: Record<ProjectType, string> = {
  node: 'Node.js',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  swift: 'Swift',
  monorepo: 'Monorepo',
  unknown: 'Other',
}

export function ProjectBadge({ type }: { type: ProjectType }) {
  if (type === 'unknown') return null
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">
            {type === 'monorepo' ? (
              <Boxes className="h-4 w-4 text-purple-400" />
            ) : (
              <LanguageIcon type={type} className="h-4 w-4" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>{typeLabels[type]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
