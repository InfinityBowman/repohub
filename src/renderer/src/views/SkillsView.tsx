import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Search, Loader2, Sparkles, AlertCircle, Globe, Download, ArrowUpDown } from 'lucide-react';
import { useSkills } from '@/hooks/useSkills';
import { SkillDetailPanel } from '@/components/skills/SkillDetailPanel';
import type { DirectorySkill } from '@/types';

export function SkillsView() {
  const {
    selectedSkill,
    loadingDetail,
    installing,
    error,
    directoryResults,
    directorySearchQuery,
    directoryLoading,
    searchDirectory,
    selectDirectorySkill,
    installDirectorySkill,
    setDirectorySearchQuery,
  } = useSkills();

  const [installSuccess, setInstallSuccess] = useState(false);
  const [sortByInstalls, setSortByInstalls] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSelectSkill = useCallback(
    (skill: DirectorySkill) => {
      selectDirectorySkill(skill.source, skill.skillId);
    },
    [selectDirectorySkill],
  );

  const handleInstallClick = useCallback(async () => {
    if (!selectedSkill) return;
    setInstallSuccess(false);
    await installDirectorySkill(selectedSkill.sourceId, selectedSkill.path);
    setInstallSuccess(true);
    setTimeout(() => setInstallSuccess(false), 3000);
  }, [selectedSkill, installDirectorySkill]);

  const handleSearch = useCallback(
    (query: string) => {
      setDirectorySearchQuery(query);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchDirectory(query);
      }, 300);
    },
    [searchDirectory, setDirectorySearchQuery],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sortedResults = useMemo(
    () =>
      sortByInstalls ?
        [...directoryResults].sort((a, b) => b.installs - a.installs)
      : directoryResults,
    [directoryResults, sortByInstalls],
  );

  return (
    <div className='-mx-6 -mb-6 flex h-[calc(100%+1.5rem)] overflow-hidden'>
      {/* Left panel */}
      <div className='from-background/60 to-background/80 flex w-72 shrink-0 flex-col overflow-hidden bg-linear-to-b'>
        {/* Search */}
        <div className='shrink-0 px-4 pt-4 pb-2'>
          <div className='relative'>
            <Search className='text-muted-foreground/60 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2' />
            <Input
              placeholder='Search skills...'
              value={directorySearchQuery}
              onChange={e => handleSearch(e.target.value)}
              className='border-border/30 bg-card/60 focus:bg-card/80 h-9 rounded-xl pl-9 text-xs transition-colors focus:border-blue-400/40'
            />
          </div>
        </div>

        {/* Results header */}
        {sortedResults.length > 0 && (
          <div className='flex shrink-0 items-center justify-between px-4 pb-2'>
            <span className='text-muted-foreground/50 text-[10px]'>
              {directorySearchQuery.trim() ?
                `${sortedResults.length} result${sortedResults.length !== 1 ? 's' : ''}`
              : 'Popular'}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSortByInstalls(!sortByInstalls)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors',
                    sortByInstalls ? 'text-blue-400/80' : (
                      'text-muted-foreground/50 hover:text-muted-foreground'
                    ),
                  )}
                >
                  <ArrowUpDown className='h-2.5 w-2.5' />
                  {sortByInstalls ? 'Popular' : 'Relevant'}
                </button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>
                {sortByInstalls ? 'Sorted by installs' : 'Sorted by relevance'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Results list */}
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='space-y-1 px-3 pb-3'>
            {error && (
              <div className='flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-[10px] text-red-400'>
                <AlertCircle className='h-3 w-3 shrink-0' />
                {error}
              </div>
            )}
            {directoryLoading && (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
              </div>
            )}
            {!directoryLoading && !directorySearchQuery.trim() && sortedResults.length === 0 && (
              <div className='py-12 text-center'>
                <Globe className='text-muted-foreground/20 mx-auto mb-3 h-10 w-10' />
                <p className='text-muted-foreground/60 text-sm font-medium'>skills.sh</p>
                <p className='text-muted-foreground/40 mt-1 text-xs'>
                  Search 54,000+ community skills
                </p>
              </div>
            )}
            {!directoryLoading &&
              directorySearchQuery.trim() &&
              sortedResults.length === 0 &&
              !error && (
                <div className='text-muted-foreground/50 py-8 text-center text-xs'>
                  No skills found
                </div>
              )}
            {sortedResults.map((skill, i) => (
              <button
                key={`${skill.source}:${skill.skillId}`}
                onClick={() => handleSelectSkill(skill)}
                className={cn(
                  'group w-full rounded-2xl px-3.5 py-3 text-left transition-all duration-150',
                  (
                    selectedSkill?.path === skill.skillId &&
                      selectedSkill?.sourceId === skill.source
                  ) ?
                    'bg-card/80'
                  : 'hover:bg-card/30',
                )}
              >
                <div className='flex items-center gap-2'>
                  <span className='text-muted-foreground/30 w-4 shrink-0 text-right font-mono text-[10px]'>
                    {i + 1}
                  </span>
                  <Sparkles className='h-3.5 w-3.5 shrink-0 text-purple-400/60' />
                  <span className='min-w-0 truncate text-sm font-semibold'>{skill.name}</span>
                </div>
                <div className='mt-1 flex items-center gap-2 pl-6'>
                  <span className='text-muted-foreground/40 truncate text-[10px]'>
                    {skill.source}
                  </span>
                  <span className='flex shrink-0 items-center gap-0.5 text-[10px] text-green-400/70'>
                    <Download className='h-2.5 w-2.5' />
                    {formatInstalls(skill.installs)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className='via-border/30 w-px bg-linear-to-b from-transparent to-transparent' />

      {/* Right panel */}
      {loadingDetail ?
        <div className='flex flex-1 flex-col items-center justify-center gap-2'>
          <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
          <p className='text-muted-foreground/50 text-xs'>Scanning for vulnerabilities...</p>
        </div>
      : selectedSkill ?
        <SkillDetailPanel
          skill={selectedSkill}
          installing={installing}
          installSuccess={installSuccess}
          onInstall={handleInstallClick}
        />
      : <div className='flex flex-1 items-center justify-center'>
          <div className='text-center'>
            <Sparkles className='text-muted-foreground/30 mx-auto mb-4 h-12 w-12' />
            <p className='text-muted-foreground/60 text-sm'>Select a skill</p>
            <p className='text-muted-foreground/40 mt-1 text-xs'>
              Search and install skills from the skills.sh ecosystem
            </p>
          </div>
        </div>
      }
    </div>
  );
}

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
