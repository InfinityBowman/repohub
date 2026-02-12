import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Search,
  Loader2,
  Sparkles,
  Download,
  Check,
  FileText,
  ChevronRight,
  AlertCircle,
  FolderDown,
} from 'lucide-react';
import { useSkills } from '@/hooks/useSkills';
import type { SkillSummary } from '@/types';

export function SkillsView() {
  const {
    sources,
    activeSourceId,
    skills,
    selectedSkill,
    loading,
    loadingDetail,
    installing,
    error,
    searchQuery,
    selectSource,
    selectSkill,
    installSkill,
    setSearchQuery,
  } = useSkills();

  const [installSuccess, setInstallSuccess] = useState(false);

  const handleSelectSkill = useCallback(
    (skill: SkillSummary) => {
      selectSkill(skill.sourceId, skill.path);
    },
    [selectSkill],
  );

  const handleInstall = useCallback(async () => {
    if (!selectedSkill) return;
    setInstallSuccess(false);
    await installSkill(selectedSkill.sourceId, selectedSkill.path);
    // If no error was set, install succeeded
    if (!useSkills.prototype) {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 3000);
    }
  }, [selectedSkill, installSkill]);

  const handleInstallClick = useCallback(async () => {
    if (!selectedSkill) return;
    setInstallSuccess(false);
    await installSkill(selectedSkill.sourceId, selectedSkill.path);
    setInstallSuccess(true);
    setTimeout(() => setInstallSuccess(false), 3000);
  }, [selectedSkill, installSkill]);

  return (
    <div className='-mx-6 -mb-6 flex h-[calc(100%+1.5rem)] overflow-hidden'>
      {/* Left panel */}
      <div className='from-background/60 to-background/80 flex w-72 shrink-0 flex-col overflow-hidden bg-linear-to-b'>
        {/* Source selector */}
        <div className='shrink-0 px-4 pt-4 pb-2'>
          <div className='bg-background/60 inline-flex w-full items-center gap-1 rounded-xl p-1'>
            {sources.map(source => (
              <Tooltip key={source.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => selectSource(source.id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
                      activeSourceId === source.id
                        ? 'bg-blue-400/15 text-blue-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                    )}
                  >
                    {source.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className='text-xs'>
                  {source.owner}/{source.repo}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className='shrink-0 px-4 pt-1 pb-3'>
          <div className='relative'>
            <Search className='text-muted-foreground/60 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2' />
            <Input
              placeholder='Filter skills...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='border-border/30 bg-card/60 focus:bg-card/80 h-9 rounded-xl pl-9 text-xs transition-colors focus:border-blue-400/40'
            />
          </div>
        </div>

        {/* Skills list */}
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='space-y-1 px-3 pb-3'>
            {error && (
              <div className='flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-[10px] text-red-400'>
                <AlertCircle className='h-3 w-3 shrink-0' />
                {error}
              </div>
            )}
            {loading && (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
              </div>
            )}
            {!loading && skills.length === 0 && activeSourceId && !error && (
              <div className='text-muted-foreground/50 py-8 text-center text-xs'>
                No skills found
              </div>
            )}
            {skills.map(skill => (
              <button
                key={`${skill.sourceId}:${skill.path}`}
                onClick={() => handleSelectSkill(skill)}
                className={cn(
                  'group w-full rounded-2xl px-3.5 py-3 text-left transition-all duration-150',
                  selectedSkill?.path === skill.path && selectedSkill?.sourceId === skill.sourceId
                    ? 'bg-card/80'
                    : 'hover:bg-card/30',
                )}
              >
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-3.5 w-3.5 shrink-0 text-purple-400/60' />
                  <span className='min-w-0 truncate text-sm font-semibold'>{skill.name}</span>
                </div>
                <p className='text-muted-foreground/60 mt-0.5 line-clamp-2 text-[10px] leading-relaxed'>
                  {skill.description}
                </p>
                {skill.tags.length > 0 && (
                  <div className='mt-1.5 flex flex-wrap gap-1'>
                    {skill.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className='text-muted-foreground/50 rounded-md bg-secondary/50 px-1.5 py-0.5 text-[9px]'
                      >
                        {tag}
                      </span>
                    ))}
                    {skill.tags.length > 3 && (
                      <span className='text-muted-foreground/40 text-[9px]'>
                        +{skill.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className='via-border/30 w-px bg-linear-to-b from-transparent to-transparent' />

      {/* Right panel */}
      {loadingDetail ? (
        <div className='flex flex-1 items-center justify-center'>
          <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        </div>
      ) : selectedSkill ? (
        <SkillDetailPanel
          skill={selectedSkill}
          installing={installing}
          installSuccess={installSuccess}
          onInstall={handleInstallClick}
        />
      ) : (
        <div className='flex flex-1 items-center justify-center'>
          <div className='text-center'>
            <Sparkles className='text-muted-foreground/30 mx-auto mb-4 h-12 w-12' />
            <p className='text-muted-foreground/60 text-sm'>Select a skill</p>
            <p className='text-muted-foreground/40 mt-1 text-xs'>
              Browse agent skills from curated repositories
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillDetailPanel({
  skill,
  installing,
  installSuccess,
  onInstall,
}: {
  skill: NonNullable<ReturnType<typeof useSkills>['selectedSkill']>;
  installing: boolean;
  installSuccess: boolean;
  onInstall: () => void;
}) {
  const source = skill.sourceId;

  return (
    <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
      {/* Header */}
      <div className='relative shrink-0 px-8 pt-6 pb-5'>
        <div className='flex items-start gap-5'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-baseline gap-3'>
              <Sparkles className='h-5 w-5 shrink-0 text-purple-400/60' />
              <span className='text-xl font-bold tracking-tight'>{skill.name}</span>
              {skill.version && (
                <span className='font-mono text-sm text-purple-400/70'>v{skill.version}</span>
              )}
            </div>
            <p className='text-muted-foreground/80 mt-1.5 text-xs leading-relaxed'>
              {skill.description}
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <Badge
                variant='outline'
                className='gap-1 rounded-full border-blue-800/40 bg-blue-900/15 text-[10px] text-blue-400/80'
              >
                {source}
              </Badge>
              {skill.tags.map(tag => (
                <Badge key={tag} variant='outline' className='rounded-full text-[10px]'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='sm'
                  variant='outline'
                  className='gap-1.5'
                  onClick={onInstall}
                  disabled={installing}
                >
                  {installing ? (
                    <>
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      Installing...
                    </>
                  ) : installSuccess ? (
                    <>
                      <Check className='h-3.5 w-3.5 text-green-400' />
                      Installed
                    </>
                  ) : (
                    <>
                      <FolderDown className='h-3.5 w-3.5' />
                      Install
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>Install skill to a directory</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className='via-border/40 absolute right-8 bottom-0 left-8 h-px bg-linear-to-r from-transparent to-transparent' />
      </div>

      {/* Files list */}
      {skill.files.length > 0 && (
        <div className='shrink-0 px-8 py-4'>
          <div className='flex flex-wrap items-center gap-2'>
            {skill.files.map(file => (
              <div
                key={file}
                className='flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5 text-[11px]'
              >
                <FileText className='text-muted-foreground/50 h-3 w-3' />
                <span className='text-muted-foreground/80'>{file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className='shrink-0 px-8'>
        <div className='via-border/25 h-px bg-linear-to-r from-transparent to-transparent' />
      </div>

      {/* Content */}
      <div className='min-h-0 flex-1 overflow-y-auto px-8 py-6'>
        {skill.content.trim() ? (
          <MarkdownRenderer>{skill.content}</MarkdownRenderer>
        ) : (
          <div className='text-muted-foreground py-8 text-center text-sm'>
            No content available for this skill.
          </div>
        )}
      </div>
    </div>
  );
}
