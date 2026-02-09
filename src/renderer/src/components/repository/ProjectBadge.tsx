import { Badge } from '@/components/ui/badge'
import type { ProjectType } from '@/types'

const typeConfig: Record<ProjectType, { label: string; className: string }> = {
  node: { label: 'Node.js', className: 'bg-green-900/50 text-green-300 border-green-800/50' },
  python: { label: 'Python', className: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50' },
  rust: { label: 'Rust', className: 'bg-orange-900/50 text-orange-300 border-orange-800/50' },
  go: { label: 'Go', className: 'bg-cyan-900/50 text-cyan-300 border-cyan-800/50' },
  java: { label: 'Java', className: 'bg-red-900/50 text-red-300 border-red-800/50' },
  swift: { label: 'Swift', className: 'bg-blue-900/50 text-blue-300 border-blue-800/50' },
  monorepo: { label: 'Monorepo', className: 'bg-purple-900/50 text-purple-300 border-purple-800/50' },
  unknown: { label: 'Other', className: 'bg-secondary text-muted-foreground border-border' },
}

export function ProjectBadge({ type }: { type: ProjectType }) {
  const config = typeConfig[type]
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
