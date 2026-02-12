import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Check,
  FileText,
  AlertCircle,
  FolderDown,
  Globe,
  Download,
  ArrowUpDown,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useSkills } from '@/hooks/useSkills';
import { scanSkillFiles } from '@/lib/skill-scanner';
import type { ScanWarning } from '@/lib/skill-scanner';
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
    sortByInstalls,
    searchDirectory,
    selectDirectorySkill,
    installDirectorySkill,
    setDirectorySearchQuery,
    setSortByInstalls,
  } = useSkills();

  const [installSuccess, setInstallSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  return (
    <div className="-mx-6 -mb-6 flex h-[calc(100%+1.5rem)] overflow-hidden">
      {/* Left panel */}
      <div className="from-background/60 to-background/80 flex w-72 shrink-0 flex-col overflow-hidden bg-linear-to-b">
        {/* Search */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="text-muted-foreground/60 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search skills..."
              value={directorySearchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="border-border/30 bg-card/60 focus:bg-card/80 h-9 rounded-xl pl-9 text-xs transition-colors focus:border-blue-400/40"
            />
          </div>
        </div>

        {/* Results header */}
        {directoryResults.length > 0 && (
          <div className="flex shrink-0 items-center justify-between px-4 pb-2">
            <span className="text-muted-foreground/50 text-[10px]">
              {directorySearchQuery.trim()
                ? `${directoryResults.length} result${directoryResults.length !== 1 ? 's' : ''}`
                : 'Popular'}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSortByInstalls(!sortByInstalls)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors',
                    sortByInstalls
                      ? 'text-blue-400/80'
                      : 'text-muted-foreground/50 hover:text-muted-foreground',
                  )}
                >
                  <ArrowUpDown className="h-2.5 w-2.5" />
                  {sortByInstalls ? 'Popular' : 'Relevant'}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {sortByInstalls ? 'Sorted by installs' : 'Sorted by relevance'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Results list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-1 px-3 pb-3">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-[10px] text-red-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {error}
              </div>
            )}
            {directoryLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            )}
            {!directoryLoading && !directorySearchQuery.trim() && directoryResults.length === 0 && (
              <div className="py-12 text-center">
                <Globe className="text-muted-foreground/20 mx-auto mb-3 h-10 w-10" />
                <p className="text-muted-foreground/60 text-sm font-medium">skills.sh</p>
                <p className="text-muted-foreground/40 mt-1 text-xs">
                  Search 54,000+ community skills
                </p>
              </div>
            )}
            {!directoryLoading &&
              directorySearchQuery.trim() &&
              directoryResults.length === 0 &&
              !error && (
                <div className="text-muted-foreground/50 py-8 text-center text-xs">
                  No skills found
                </div>
              )}
            {directoryResults.map((skill, i) => (
              <button
                key={`${skill.source}:${skill.skillId}`}
                onClick={() => handleSelectSkill(skill)}
                className={cn(
                  'group w-full rounded-2xl px-3.5 py-3 text-left transition-all duration-150',
                  selectedSkill?.path === skill.skillId &&
                    selectedSkill?.sourceId === skill.source
                    ? 'bg-card/80'
                    : 'hover:bg-card/30',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/30 w-4 shrink-0 text-right font-mono text-[10px]">
                    {i + 1}
                  </span>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-400/60" />
                  <span className="min-w-0 truncate text-sm font-semibold">{skill.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-6">
                  <span className="text-muted-foreground/40 truncate text-[10px]">
                    {skill.source}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-green-400/70">
                    <Download className="h-2.5 w-2.5" />
                    {formatInstalls(skill.installs)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="via-border/30 w-px bg-linear-to-b from-transparent to-transparent" />

      {/* Right panel */}
      {loadingDetail ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : selectedSkill ? (
        <SkillDetailPanel
          skill={selectedSkill}
          installing={installing}
          installSuccess={installSuccess}
          onInstall={handleInstallClick}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Sparkles className="text-muted-foreground/30 mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground/60 text-sm">Select a skill</p>
            <p className="text-muted-foreground/40 mt-1 text-xs">
              Search and install skills from the skills.sh ecosystem
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SecurityBadge({ warnings }: { warnings: ScanWarning[] }) {
  const hasHigh = warnings.some(w => w.severity === 'high');

  if (warnings.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 rounded-full border border-green-800/30 bg-green-900/10 px-2 py-1">
            <ShieldCheck className="h-3 w-3 text-green-400/80" />
            <span className="text-[10px] text-green-400/80">Clean</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs">All skill files scanned — no hidden content detected</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-1 transition-colors',
            hasHigh
              ? 'border-red-800/40 bg-red-900/15 text-red-400 hover:bg-red-900/25'
              : 'border-yellow-800/40 bg-yellow-900/15 text-yellow-400 hover:bg-yellow-900/25',
          )}
        >
          <ShieldAlert className="h-3 w-3" />
          <span className="text-[10px] font-medium">
            {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="text-[11px] font-medium">
            Potential prompt injection vectors
          </p>
          <p className="text-muted-foreground/60 mt-0.5 text-[10px]">
            Hidden content detected across skill files that an agent could read but you can't see
          </p>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto p-3">
          {warnings.map((w, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                    w.severity === 'high'
                      ? 'bg-red-900/30 text-red-400'
                      : w.severity === 'medium'
                        ? 'bg-yellow-900/30 text-yellow-400'
                        : 'bg-blue-900/30 text-blue-400',
                  )}
                >
                  {w.severity}
                </span>
                <span className="min-w-0 truncate text-[11px] text-white/70">{w.message}</span>
              </div>
              {w.file && (
                <span className="text-muted-foreground/50 ml-0.5 font-mono text-[9px]">
                  {w.file}
                </span>
              )}
              {w.details && (
                <pre className="max-h-20 overflow-auto rounded bg-black/30 px-2.5 py-1.5 font-mono text-[10px] text-white/50">
                  {w.details}
                </pre>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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

  // Scan all skill files for hidden prompt injection vectors
  const warnings = useMemo(
    () => scanSkillFiles(skill.content, skill.description || '', skill.allTextContent),
    [skill.content, skill.description, skill.allTextContent],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="relative shrink-0 px-8 pt-6 pb-5">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-purple-400/60" />
              <span className="text-xl font-bold tracking-tight">{skill.name}</span>
              {skill.version && (
                <span className="font-mono text-sm text-purple-400/70">v{skill.version}</span>
              )}
            </div>
            <p className="text-muted-foreground/80 mt-1.5 text-xs leading-relaxed">
              {skill.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-blue-800/40 bg-blue-900/15 text-[10px] text-blue-400/80"
              >
                {source}
              </Badge>
              {skill.tags.map(tag => (
                <Badge key={tag} variant="outline" className="rounded-full text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SecurityBadge warnings={warnings} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={onInstall}
                  disabled={installing}
                >
                  {installing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Installing...
                    </>
                  ) : installSuccess ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-400" />
                      Installed
                    </>
                  ) : (
                    <>
                      <FolderDown className="h-3.5 w-3.5" />
                      Install
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Install skill to a directory</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="via-border/40 absolute right-8 bottom-0 left-8 h-px bg-linear-to-r from-transparent to-transparent" />
      </div>

      {/* Files list */}
      {skill.files.length > 0 && (
        <div className="shrink-0 px-8 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {skill.files.map(file => (
              <div
                key={file}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5 text-[11px]"
              >
                <FileText className="text-muted-foreground/50 h-3 w-3" />
                <span className="text-muted-foreground/80">{file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="shrink-0 px-8">
        <div className="via-border/25 h-px bg-linear-to-r from-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {skill.content.trim() ? (
          <MarkdownRenderer>{skill.content}</MarkdownRenderer>
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No content available for this skill.
          </div>
        )}
      </div>
    </div>
  );
}
