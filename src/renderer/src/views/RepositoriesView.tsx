import { RefreshCw, Search, ChevronRight, ChevronDown, FolderOpen, Shield } from 'lucide-react'
import { useState, useMemo } from 'react'
import type { Repository } from '@/types'
import { useRepositories } from '@/hooks/useRepositories'
import { useHealth } from '@/hooks/useHealth'
import { RepositoryCard } from '@/components/repository/RepositoryCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

interface TreeNode {
  name: string
  folders: Record<string, TreeNode>
  repos: Repository[]
}

function buildTree(repos: Repository[]): TreeNode {
  const root: TreeNode = { name: '', folders: {}, repos: [] }

  for (const repo of repos) {
    const segments = repo.name.split('/')
    if (segments.length === 1) {
      root.repos.push(repo)
    } else {
      let node = root
      // Navigate/create folder nodes for all segments except the last
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i]
        if (!node.folders[seg]) {
          node.folders[seg] = { name: seg, folders: {}, repos: [] }
        }
        node = node.folders[seg]
      }
      node.repos.push(repo)
    }
  }

  return root
}

function FolderNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(true)

  const folderKeys = Object.keys(node.folders).sort()
  const hasChildren = folderKeys.length > 0 || node.repos.length > 0

  if (!hasChildren) return null

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="font-medium">{node.name}</span>
      </button>
      {open && (
        <div>
          {folderKeys.map((key) => (
            <FolderNode key={key} node={node.folders[key]} depth={depth + 1} />
          ))}
          <div className="flex flex-col gap-1" style={{ paddingLeft: `${depth * 20 + 20}px` }}>
            {node.repos.map((repo) => (
              <RepositoryCard key={repo.id} repo={repo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function RepositoriesView() {
  const { repositories, allRepositories, loading, error, scan, filterText, setFilter } = useRepositories()
  const { checkAllHealth } = useHealth()

  const tree = useMemo(() => buildTree(repositories), [repositories])

  const folderKeys = Object.keys(tree.folders).sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Repositories</h2>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nodeRepoIds = allRepositories
                      .filter((r) => r.projectType === 'node' || r.projectType === 'monorepo')
                      .map((r) => r.id)
                    if (nodeRepoIds.length > 0) checkAllHealth(nodeRepoIds)
                  }}
                >
                  <Shield className="h-4 w-4" />
                  Check All
                </Button>
              </TooltipTrigger>
              <TooltipContent>Check dependency health for all Node.js projects</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={scan} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            {loading ? 'Scanning...' : 'Rescan'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter repositories..."
          value={filterText}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
        {filterText && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {repositories.length} of {allRepositories.length}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {/* Top-level repos (no parent folder) */}
        {tree.repos.map((repo) => (
          <RepositoryCard key={repo.id} repo={repo} />
        ))}

        {/* Folder groups */}
        {folderKeys.map((key) => (
          <FolderNode key={key} node={tree.folders[key]} depth={0} />
        ))}

        {!loading && repositories.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            {filterText
              ? 'No repositories match your filter.'
              : 'No repositories found. Try rescanning.'}
          </div>
        )}
      </div>
    </div>
  )
}
