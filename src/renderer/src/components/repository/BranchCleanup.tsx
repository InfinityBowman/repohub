import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { BranchInfo } from '@/types';

export function BranchCleanup({ repoId }: { repoId: string }) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.git.listBranches(repoId);
      setBranches(result);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const mergedBranches = branches.filter(
    b => b.isMerged && !b.isCurrent && !['main', 'master', 'develop'].includes(b.name),
  );

  const handleDelete = async (branchName: string) => {
    setDeleting(prev => new Set(prev).add(branchName));
    try {
      await window.electron.git.deleteBranches(repoId, [branchName]);
      await fetchBranches();
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(branchName);
        return next;
      });
    }
  };

  const handleDeleteAllMerged = async () => {
    const names = mergedBranches.map(b => b.name);
    setDeleting(new Set(names));
    try {
      await window.electron.git.deleteBranches(repoId, names);
      await fetchBranches();
    } finally {
      setDeleting(new Set());
    }
  };

  if (loading) {
    return (
      <div className='text-muted-foreground flex items-center gap-2 py-4 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        Loading branches...
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <span>{branches.length} local branches</span>
          {mergedBranches.length > 0 && (
            <Badge
              variant='outline'
              className='border-yellow-800/50 bg-yellow-900/20 text-yellow-400'
            >
              {mergedBranches.length} merged
            </Badge>
          )}
        </div>
        <div className='flex items-center gap-1'>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon-xs' onClick={fetchBranches}>
                  <RefreshCw className='h-3.5 w-3.5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh branches</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {mergedBranches.length > 0 && (
            <Button
              variant='destructive'
              size='sm'
              className='h-7 text-xs'
              onClick={handleDeleteAllMerged}
              disabled={deleting.size > 0}
            >
              {deleting.size > 0 ?
                <Loader2 className='mr-1 h-3 w-3 animate-spin' />
              : <Trash2 className='mr-1 h-3 w-3' />}
              Delete All Merged
            </Button>
          )}
        </div>
      </div>

      {branches.length === 0 ?
        <p className='text-muted-foreground text-sm'>No local branches found.</p>
      : <div className='flex flex-col gap-1'>
          {branches.map(branch => {
            const isMergedDeletable =
              branch.isMerged &&
              !branch.isCurrent &&
              !['main', 'master', 'develop'].includes(branch.name);

            return (
              <div
                key={branch.name}
                className='border-border/50 bg-background/50 flex items-center justify-between rounded-md border px-3 py-2'
              >
                <div className='flex items-center gap-2 overflow-hidden'>
                  <GitBranch className='text-muted-foreground h-3.5 w-3.5 flex-shrink-0' />
                  <span className='truncate text-sm font-medium'>{branch.name}</span>
                  {branch.isCurrent && (
                    <Badge
                      variant='outline'
                      className='border-blue-800/50 bg-blue-900/20 px-1.5 py-0 text-[10px] text-blue-400'
                    >
                      current
                    </Badge>
                  )}
                  {branch.isMerged && !branch.isCurrent && (
                    <Badge
                      variant='outline'
                      className='border-green-800/50 bg-green-900/20 px-1.5 py-0 text-[10px] text-green-400'
                    >
                      merged
                    </Badge>
                  )}
                  {branch.upstream && (
                    <span className='text-muted-foreground truncate text-xs'>
                      {branch.upstream}
                    </span>
                  )}
                  <span className='text-muted-foreground text-xs'>{branch.lastCommit}</span>
                </div>
                {isMergedDeletable && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon-xs'
                          onClick={() => handleDelete(branch.name)}
                          disabled={deleting.has(branch.name)}
                          className='hover:bg-destructive/20 hover:text-destructive-foreground'
                        >
                          {deleting.has(branch.name) ?
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                          : <Trash2 className='h-3.5 w-3.5' />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete branch</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}
