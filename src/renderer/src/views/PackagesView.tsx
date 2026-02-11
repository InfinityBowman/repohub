import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Search,
  ExternalLink,
  Scale,
  Sparkles,
  ChevronRight,
  Loader2,
  Copy,
  Package,
  BookOpen,
  Code2,
  Check,
  Download,
  Star,
  Clock,
  FileCode2,
  Layers,
  TrendingUp,
  GitFork,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { usePackages } from '@/hooks/usePackages';
import { useTrending } from '@/hooks/useTrending';
import { SourceExplorer } from '@/components/packages/SourceExplorer';
import type { PackageDetail, TypeScriptSupport, TrendingRepo, TrendingPeriod } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return 'unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

const LANGUAGE_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'TypeScript', value: 'TypeScript' },
  { label: 'JavaScript', value: 'JavaScript' },
  { label: 'Python', value: 'Python' },
  { label: 'Rust', value: 'Rust' },
  { label: 'Go', value: 'Go' },
] as const;

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  Swift: '#F05138',
  Ruby: '#701516',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Zig: '#ec915c',
  Elixir: '#6e4a7e',
};

// ─── Shared Components ──────────────────────────────────────────

function TsBadge({ ts }: { ts: TypeScriptSupport }) {
  if (ts === 'built-in') {
    return (
      <Badge variant='outline' className='gap-1 border-blue-800/50 bg-blue-900/20 text-blue-400'>
        <span className='font-mono text-[10px]'>TS</span>Built-in
      </Badge>
    );
  }
  if (ts === 'types') {
    return (
      <Badge variant='outline' className='gap-1 border-blue-800/50 bg-blue-900/20 text-blue-400'>
        <span className='font-mono text-[10px]'>DT</span>@types
      </Badge>
    );
  }
  return (
    <Badge variant='outline' className='border-red-800/50 bg-red-900/20 text-[10px] text-red-400'>
      No types
    </Badge>
  );
}

function ExternalLinks({ pkg }: { pkg: PackageDetail }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`pnpm add ${pkg.name}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pkg.name]);

  const openUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        window.electron.shell.openUrl(url);
      }
    } catch {
      // Invalid URL, ignore
    }
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size='icon-xs'
            variant='ghost'
            className='text-muted-foreground'
            onClick={() => openUrl(pkg.links.npm)}
          >
            <ExternalLink className='h-3.5 w-3.5' />
          </Button>
        </TooltipTrigger>
        <TooltipContent className='text-xs'>Open on npmjs.com</TooltipContent>
      </Tooltip>
      {pkg.links.repository && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size='icon-xs'
              variant='ghost'
              className='text-muted-foreground'
              onClick={() => openUrl(pkg.links.repository!)}
            >
              <Star className='h-3.5 w-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent className='text-xs'>View on GitHub</TooltipContent>
        </Tooltip>
      )}
      {pkg.links.homepage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size='icon-xs'
              variant='ghost'
              className='text-muted-foreground'
              onClick={() => openUrl(pkg.links.homepage!)}
            >
              <BookOpen className='h-3.5 w-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent className='text-xs'>{pkg.links.homepage}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size='icon-xs'
            variant='ghost'
            className='text-muted-foreground'
            onClick={handleCopy}
          >
            {copied ? <Check className='h-3.5 w-3.5 text-green-400' /> : <Copy className='h-3.5 w-3.5' />}
          </Button>
        </TooltipTrigger>
        <TooltipContent className='text-xs'>
          {copied ? 'Copied!' : `Copy: pnpm add ${pkg.name}`}
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function CloneActions({ pkg }: { pkg: PackageDetail }) {
  const [open, setOpen] = useState(false);
  const { cloneStatuses, cloningPackages, deleteClone, loadCloneStatus } = usePackages();
  const hasRepo = !!pkg.links.repository;
  const status = cloneStatuses[pkg.name];
  const isCloning = cloningPackages.has(pkg.name);
  const isCloned = status?.cloned;

  // Load clone status on mount
  useEffect(() => {
    if (hasRepo) loadCloneStatus(pkg.name);
  }, [pkg.name, hasRepo, loadCloneStatus]);

  if (isCloning) {
    return (
      <Button size='xs' variant='outline' className='gap-1.5 text-xs' disabled>
        <Loader2 className='h-3 w-3 animate-spin' />
        Cloning...
      </Button>
    );
  }

  return (
    <>
      <div className='flex items-center gap-1'>
        {isCloned ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='xs'
                  variant='outline'
                  className='gap-1.5 border-green-800/40 bg-green-900/15 text-xs text-green-400/80'
                  onClick={() => setOpen(true)}
                >
                  <Code2 className='h-3 w-3' />
                  Source
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>Browse cloned source</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='icon-xs'
                  variant='ghost'
                  className='text-muted-foreground hover:text-red-400'
                  onClick={() => deleteClone(pkg.name)}
                >
                  <Trash2 className='h-3 w-3' />
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>Delete clone</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size='xs'
                variant='outline'
                className='gap-1.5 text-xs'
                disabled={!hasRepo}
                onClick={() => setOpen(true)}
              >
                <Download className='h-3 w-3' />
                Clone
              </Button>
            </TooltipTrigger>
            <TooltipContent className='text-xs'>
              {hasRepo ? 'Clone & explore source code' : 'No GitHub repository available'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className='flex h-[80vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl'
          showCloseButton
        >
          <DialogTitle className='sr-only'>{pkg.name} — Source</DialogTitle>
          <SourceExplorer
            packageName={pkg.name}
            repoUrl={pkg.links.repository || ''}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReadmeContent({ readme }: { readme: string }) {
  const [mode, setMode] = useState<'preview' | 'source'>('preview');

  if (!readme || readme.trim() === '') {
    return (
      <div className='text-muted-foreground py-8 text-center text-sm'>
        No README available for this package.
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Mode toggle — pinned above scroll */}
      <div className='shrink-0 px-8 pt-4 pb-3'>
        <div className='flex items-center gap-1'>
          {([
            { id: 'preview' as const, icon: BookOpen, label: 'Preview' },
            { id: 'source' as const, icon: Code2, label: 'Source' },
          ]).map(m => (
            <Tooltip key={m.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors',
                    mode === m.id
                      ? 'bg-blue-400/15 text-blue-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                  )}
                >
                  <m.icon className='h-3 w-3' />
                  {m.label}
                </button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>{m.label} mode</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className='min-h-0 flex-1 overflow-y-auto px-8 pb-6'>
      {mode === 'source' ? (
        <div className='overflow-auto rounded-lg border border-border/30 bg-background p-4 font-mono text-xs leading-relaxed'>
          <code className='block'>
            {readme.split('\n').map((line, i) => (
              <div key={i} className='-mx-1 flex rounded-sm px-1 hover:bg-secondary/30'>
                <span className='mr-4 w-8 shrink-0 select-none text-right text-muted-foreground/50'>
                  {i + 1}
                </span>
                <span className='text-foreground/70'>{line || '\u200B'}</span>
              </div>
            ))}
          </code>
        </div>
      ) : (
        <div className='markdown-body prose prose-sm max-w-none'>
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  onClick={e => {
                    e.preventDefault();
                    if (href) {
                      try {
                        const parsed = new URL(href);
                        if (['http:', 'https:'].includes(parsed.protocol)) {
                          window.electron.shell.openUrl(href);
                        }
                      } catch { /* relative link, ignore */ }
                    }
                  }}
                >
                  {children}
                </a>
              ),
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt}
                  onError={e => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                  }}
                />
              ),
            }}
          >
            {readme}
          </Markdown>
        </div>
      )}
      </div>
    </div>
  );
}

function AISummaryPlaceholder() {
  return (
    <div className='group flex w-full items-center gap-3 rounded-lg border border-dashed border-blue-400/30 bg-blue-400/5 p-4'>
      <div className='rounded-lg bg-blue-400/10 p-2'>
        <Sparkles className='h-4 w-4 text-blue-400' />
      </div>
      <div className='text-left'>
        <div className='text-foreground text-xs font-medium'>AI Summary</div>
        <div className='text-muted-foreground text-[10px]'>Coming soon — Claude-powered analysis</div>
      </div>
      <ChevronRight className='text-muted-foreground/40 ml-auto h-4 w-4' />
    </div>
  );
}

function LanguageDot({ language }: { language: string | null }) {
  if (!language) return null;
  const color = LANGUAGE_COLORS[language] || '#8b8b8b';
  return (
    <span
      className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
      style={{ backgroundColor: color }}
    />
  );
}

// ─── Main View ──────────────────────────────────────────────────

type ViewMode = 'search' | 'trending';

export function PackagesView() {
  const {
    searchResults,
    isSearching,
    selectedPackage,
    selectedPackageName,
    isLoadingDetail,
    error: searchError,
    search,
    loadDetails,
    setSearchQuery,
    setSelectedPackage,
  } = usePackages();

  const {
    repos: trendingRepos,
    isLoading: isTrendingLoading,
    error: trendingError,
    language: trendingLanguage,
    period: trendingPeriod,
    selectedRepo: selectedTrendingRepo,
    fetchTrending,
    setLanguage,
    setPeriod,
    selectRepo,
  } = useTrending();

  const [mode, setMode] = useState<ViewMode>('search');
  const [inputValue, setInputValue] = useState('');
  const [tab, setTab] = useState<'preview' | 'source' | 'ai'>('preview');
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const trendingFetched = useRef(false);

  // Focus search on mount
  useEffect(() => {
    if (mode === 'search') {
      searchRef.current?.focus();
    }
  }, [mode]);

  // Fetch trending on first switch to trending mode
  useEffect(() => {
    if (mode === 'trending' && !trendingFetched.current && trendingRepos.length === 0) {
      trendingFetched.current = true;
      fetchTrending();
    }
  }, [mode, trendingRepos.length, fetchTrending]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setInputValue(value);
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(value);
      }, 300);
    },
    [search, setSearchQuery],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectPackage = useCallback(
    (name: string) => {
      loadDetails(name);
      setTab('preview');
    },
    [loadDetails],
  );

  const handleSwitchMode = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);
      if (newMode === 'search') {
        selectRepo(null);
      } else {
        setSelectedPackage(null);
      }
    },
    [selectRepo, setSelectedPackage],
  );

  const handleSelectTrendingRepo = useCallback(
    (repo: TrendingRepo) => {
      selectRepo(repo);
    },
    [selectRepo],
  );

  // Determine right panel content
  const rightPanel = (() => {
    if (mode === 'search') {
      if (selectedPackage) {
        return <PackageDetailPanel pkg={selectedPackage} tab={tab} setTab={setTab} />;
      }
      if (isLoadingDetail) {
        return (
          <div className='flex flex-1 items-center justify-center'>
            <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
          </div>
        );
      }
      return (
        <div className='flex flex-1 items-center justify-center'>
          <div className='text-center'>
            <Package className='text-muted-foreground/30 mx-auto mb-4 h-12 w-12' />
            <p className='text-muted-foreground/60 text-sm'>Search for a package</p>
            <p className='text-muted-foreground/40 mt-1 text-xs'>
              Explore npm packages without leaving RepoHub
            </p>
          </div>
        </div>
      );
    }

    // trending mode
    if (selectedTrendingRepo) {
      return <TrendingRepoDetailPanel repo={selectedTrendingRepo} />;
    }
    return (
      <div className='flex flex-1 items-center justify-center'>
        <div className='text-center'>
          <TrendingUp className='text-muted-foreground/30 mx-auto mb-4 h-12 w-12' />
          <p className='text-muted-foreground/60 text-sm'>Select a trending repo</p>
          <p className='text-muted-foreground/40 mt-1 text-xs'>
            Discover hot new projects on GitHub
          </p>
        </div>
      </div>
    );
  })();

  return (
    <div className='-mx-6 -mb-6 flex h-[calc(100%+1.5rem)] overflow-hidden'>
      {/* Left: Search/Trending + Results — soft sidebar */}
      <div className='flex w-72 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-background/60 to-background/80'>
        {/* Mode toggle */}
        <div className='shrink-0 px-4 pt-4 pb-2'>
          <div className='inline-flex w-full items-center gap-1 rounded-xl bg-background/60 p-1'>
            {([
              { key: 'search' as ViewMode, icon: Search, label: 'Search' },
              { key: 'trending' as ViewMode, icon: TrendingUp, label: 'Trending' },
            ]).map(m => (
              <Tooltip key={m.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSwitchMode(m.key)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
                      mode === m.key
                        ? 'bg-blue-400/15 text-blue-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                    )}
                  >
                    <m.icon className='h-3 w-3' />
                    {m.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className='text-xs'>
                  {m.key === 'search' ? 'Search npm packages' : 'GitHub trending repos'}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {mode === 'search' ? (
          <>
            {/* Search input */}
            <div className='shrink-0 px-4 pt-1 pb-3'>
              <div className='relative'>
                <Search className='text-muted-foreground/60 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2' />
                <Input
                  ref={searchRef}
                  placeholder='Search packages...'
                  value={inputValue}
                  onChange={e => handleSearchChange(e.target.value)}
                  className='h-9 rounded-xl border-border/30 bg-card/60 pl-9 text-xs transition-colors focus:border-blue-400/40 focus:bg-card/80'
                />
                {isSearching && (
                  <Loader2 className='text-muted-foreground absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin' />
                )}
              </div>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto'>
              <div className='space-y-1 px-3 pb-3'>
                {searchError && (
                  <div className='rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-[10px] text-red-400'>
                    {searchError}
                  </div>
                )}
                {searchResults.map(r => (
                  <button
                    key={r.name}
                    onClick={() => handleSelectPackage(r.name)}
                    className={cn(
                      'group w-full rounded-2xl px-3.5 py-3 text-left transition-all duration-150',
                      selectedPackageName === r.name
                        ? 'bg-card/80'
                        : 'hover:bg-card/30',
                    )}
                  >
                    <div className='flex items-baseline gap-2'>
                      <span className='text-sm font-semibold'>{r.name}</span>
                      <span className='text-muted-foreground/60 font-mono text-[10px]'>
                        {r.version}
                      </span>
                    </div>
                    <p className='text-muted-foreground/60 mt-0.5 line-clamp-2 text-[10px] leading-relaxed'>
                      {r.description}
                    </p>
                    <div className='mt-1.5 flex items-center gap-2.5'>
                      <span className='text-muted-foreground/50 font-mono text-[10px]'>
                        {r.publisher}
                      </span>
                    </div>
                  </button>
                ))}
                {!isSearching && inputValue && searchResults.length === 0 && (
                  <div className='text-muted-foreground/50 py-8 text-center text-xs'>
                    No packages found
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Trending filters */}
            <div className='shrink-0 space-y-2 px-4 pt-1 pb-3'>
              {/* Period toggle */}
              <div className='flex items-center gap-1'>
                {([
                  { key: 'week' as TrendingPeriod, label: 'This week' },
                  { key: 'month' as TrendingPeriod, label: 'This month' },
                ]).map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors',
                      trendingPeriod === p.key
                        ? 'bg-blue-400/15 text-blue-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Language chips */}
              <div className='flex flex-wrap gap-1'>
                {LANGUAGE_FILTERS.map(l => (
                  <button
                    key={l.label}
                    onClick={() => setLanguage(l.value)}
                    className={cn(
                      'rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors',
                      trendingLanguage === l.value
                        ? 'bg-green-400/15 text-green-400'
                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-secondary/50',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto'>
              <div className='space-y-1 px-3 pb-3'>
                {trendingError && (
                  <div className='flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-[10px] text-red-400'>
                    <AlertCircle className='h-3 w-3 shrink-0' />
                    {trendingError}
                  </div>
                )}
                {isTrendingLoading && (
                  <div className='flex items-center justify-center py-8'>
                    <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
                  </div>
                )}
                {!isTrendingLoading && trendingRepos.length === 0 && !trendingError && (
                  <div className='text-muted-foreground/50 py-8 text-center text-xs'>
                    No trending repos found
                  </div>
                )}
                {trendingRepos.map(repo => (
                  <button
                    key={repo.fullName}
                    onClick={() => handleSelectTrendingRepo(repo)}
                    className={cn(
                      'group w-full rounded-2xl px-3.5 py-3 text-left transition-all duration-150',
                      selectedTrendingRepo?.fullName === repo.fullName
                        ? 'bg-card/80'
                        : 'hover:bg-card/30',
                    )}
                  >
                    <div className='flex items-center gap-2'>
                      <span className='min-w-0 truncate text-sm font-semibold'>{repo.name}</span>
                      <div className='flex shrink-0 items-center gap-1 text-[10px] text-amber-400/80'>
                        <Star className='h-2.5 w-2.5' />
                        {formatNumber(repo.stargazersCount)}
                      </div>
                    </div>
                    <div className='text-muted-foreground/50 mt-0.5 flex items-center gap-1.5 text-[10px]'>
                      <span>{repo.owner.login}</span>
                      {repo.language && (
                        <>
                          <span className='opacity-30'>·</span>
                          <span className='flex items-center gap-1'>
                            <LanguageDot language={repo.language} />
                            {repo.language}
                          </span>
                        </>
                      )}
                    </div>
                    <p className='text-muted-foreground/60 mt-0.5 line-clamp-2 text-[10px] leading-relaxed'>
                      {repo.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Soft divider */}
      <div className='w-px bg-gradient-to-b from-transparent via-border/30 to-transparent' />

      {/* Right panel */}
      {rightPanel}
    </div>
  );
}

// ─── Package Detail Panel ───────────────────────────────────────

function PackageDetailPanel({
  pkg,
  tab,
  setTab,
}: {
  pkg: PackageDetail;
  tab: 'preview' | 'source' | 'ai';
  setTab: (tab: 'preview' | 'source' | 'ai') => void;
}) {
  return (
    <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
      {/* Header */}
      <div className='relative shrink-0 px-8 pt-6 pb-5'>
        <div className='flex items-start gap-5'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-baseline gap-3'>
              <Package className='h-5 w-5 shrink-0 text-purple-400/60' />
              <span className='text-xl font-bold tracking-tight'>{pkg.name}</span>
              <span className='font-mono text-sm text-purple-400/70'>v{pkg.version}</span>
            </div>
            <p className='text-muted-foreground/80 mt-1.5 text-xs leading-relaxed'>
              {pkg.description}
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <TsBadge ts={pkg.typescript} />
              <Badge variant='outline' className='rounded-full text-[10px]'>
                {pkg.license}
              </Badge>
              {pkg.dependencies === 0 && (
                <Badge
                  variant='outline'
                  className='rounded-full border-green-800/40 bg-green-900/15 text-[10px] text-green-400/80'
                >
                  Zero deps
                </Badge>
              )}
              <Separator orientation='vertical' className='!h-3.5 opacity-30' />
              <CloneActions pkg={pkg} />
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <ExternalLinks pkg={pkg} />
          </div>
        </div>
        {/* Gradient fade border */}
        <div className='absolute right-8 bottom-0 left-8 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent' />
      </div>

      {/* Stats — flowing pill row */}
      <div className='shrink-0 px-8 py-4'>
        <div className='flex flex-wrap items-center gap-2.5'>
          {[
            {
              icon: Download,
              label: 'Weekly',
              value: formatNumber(pkg.weeklyDownloads),
              textClass: 'text-green-400',
              bgClass: 'bg-green-400/[0.024]',
            },
            {
              icon: Scale,
              label: 'Size',
              value: formatBytes(pkg.unpackedSize),
              textClass: 'text-amber-400',
              bgClass: 'bg-amber-400/[0.024]',
            },
            {
              icon: Clock,
              label: 'Published',
              value: formatRelativeDate(pkg.lastPublish),
              textClass: 'text-blue-400',
              bgClass: 'bg-blue-400/[0.024]',
            },
            {
              icon: FileCode2,
              label: 'Files',
              value: String(pkg.fileCount),
              textClass: 'text-purple-400',
              bgClass: 'bg-purple-400/[0.024]',
            },
            {
              icon: Layers,
              label: 'Deps',
              value: String(pkg.dependencies),
              textClass: pkg.dependencies === 0 ? 'text-green-400' : 'text-orange-400',
              bgClass: pkg.dependencies === 0 ? 'bg-green-400/[0.024]' : 'bg-orange-400/[0.024]',
            },
          ].map(stat => (
            <div
              key={stat.label}
              className={cn('flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-card/60', stat.bgClass)}
            >
              <stat.icon className={cn('h-3.5 w-3.5 opacity-60', stat.textClass)} />
              <div>
                <div className={cn('font-mono text-xs font-semibold leading-none', stat.textClass)}>
                  {stat.value}
                </div>
                <div className='text-muted-foreground/50 mt-1 text-[9px]'>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pill tabs + gradient divider */}
      <div className='relative shrink-0 px-8 pb-2'>
        <div className='inline-flex items-center gap-1.5 rounded-2xl bg-background/40 p-1.5'>
          {(
            [
              { key: 'preview', label: 'Preview', icon: BookOpen },
              { key: 'source', label: 'Source', icon: Code2 },
              { key: 'ai', label: 'AI Summary', icon: Sparkles },
            ] as const
          ).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200',
                tab === t.key
                  ? 'bg-blue-400/12 text-blue-400 shadow-sm'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-card/30',
              )}
            >
              <t.icon className='h-3.5 w-3.5' />
              {t.label}
            </button>
          ))}
        </div>
        <div className='absolute right-8 bottom-0 left-8 h-px bg-gradient-to-r from-transparent via-border/25 to-transparent' />
      </div>

      {/* Content */}
      {tab === 'preview' ? (
        <div className='min-h-0 flex-1 overflow-y-auto px-8 py-4'>
          {pkg.readme && pkg.readme.trim() !== '' ? (
            <div className='markdown-body prose prose-sm max-w-none'>
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      onClick={e => {
                        e.preventDefault();
                        if (href) {
                          try {
                            const parsed = new URL(href);
                            if (['http:', 'https:'].includes(parsed.protocol)) {
                              window.electron.shell.openUrl(href);
                            }
                          } catch { /* relative link, ignore */ }
                        }
                      }}
                    >
                      {children}
                    </a>
                  ),
                  img: ({ src, alt }) => (
                    <img
                      src={src}
                      alt={alt}
                      onError={e => {
                        const el = e.currentTarget;
                        el.style.display = 'none';
                      }}
                    />
                  ),
                }}
              >
                {pkg.readme}
              </Markdown>
            </div>
          ) : (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              No README available for this package.
            </div>
          )}
        </div>
      ) : tab === 'source' ? (
        <div className='min-h-0 flex-1 overflow-y-auto px-8 py-4'>
          {pkg.readme && pkg.readme.trim() !== '' ? (
            <div className='overflow-auto rounded-lg border border-border/30 bg-background p-4 font-mono text-xs leading-relaxed'>
              <code className='block'>
                {pkg.readme.split('\n').map((line, i) => (
                  <div key={i} className='-mx-1 flex rounded-sm px-1 hover:bg-secondary/30'>
                    <span className='mr-4 w-8 shrink-0 select-none text-right text-muted-foreground/50'>
                      {i + 1}
                    </span>
                    <span className='text-foreground/70'>{line || '\u200B'}</span>
                  </div>
                ))}
              </code>
            </div>
          ) : (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              No README available for this package.
            </div>
          )}
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='px-8 py-6'>
            <AISummaryPlaceholder />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trending Repo Detail Panel ─────────────────────────────────

function TrendingRepoDetailPanel({ repo }: { repo: TrendingRepo }) {
  const [readme, setReadme] = useState<string | null>(null);
  const [loadingReadme, setLoadingReadme] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  // Fetch README when repo changes
  useEffect(() => {
    if (fetchedRef.current === repo.fullName) return;
    fetchedRef.current = repo.fullName;
    setReadme(null);
    setLoadingReadme(true);
    window.electron.github.getTrendingReadme(repo.fullName).then(content => {
      // Guard against stale responses
      if (fetchedRef.current === repo.fullName) {
        setReadme(content);
        setLoadingReadme(false);
      }
    }).catch(() => {
      if (fetchedRef.current === repo.fullName) {
        setReadme('');
        setLoadingReadme(false);
      }
    });
  }, [repo.fullName]);

  const openUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        window.electron.shell.openUrl(url);
      }
    } catch {
      // Invalid URL, ignore
    }
  }, []);

  return (
    <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
      {/* Header */}
      <div className='relative shrink-0 px-8 pt-6 pb-5'>
        <div className='flex items-start gap-5'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-3'>
              {repo.owner.avatarUrl && (
                <img
                  src={repo.owner.avatarUrl}
                  alt={repo.owner.login}
                  className='h-8 w-8 shrink-0 rounded-full'
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className='min-w-0'>
                <div className='flex items-baseline gap-2'>
                  <span className='text-xl font-bold tracking-tight'>{repo.fullName}</span>
                </div>
              </div>
            </div>
            <p className='text-muted-foreground/80 mt-2 text-xs leading-relaxed'>
              {repo.description}
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              {repo.language && (
                <Badge
                  variant='outline'
                  className='gap-1.5 rounded-full text-[10px]'
                >
                  <LanguageDot language={repo.language} />
                  {repo.language}
                </Badge>
              )}
              {repo.license && (
                <Badge variant='outline' className='rounded-full text-[10px]'>
                  {repo.license}
                </Badge>
              )}
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            {repo.homepage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size='icon-xs'
                    variant='ghost'
                    className='text-muted-foreground'
                    onClick={() => openUrl(repo.homepage!)}
                  >
                    <BookOpen className='h-3.5 w-3.5' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className='text-xs'>Website</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='icon-xs'
                  variant='ghost'
                  className='text-muted-foreground'
                  onClick={() => openUrl(repo.htmlUrl)}
                >
                  <ExternalLink className='h-3.5 w-3.5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>Open on GitHub</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* Gradient fade border */}
        <div className='absolute right-8 bottom-0 left-8 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent' />
      </div>

      {/* Stats — flowing pill row */}
      <div className='shrink-0 px-8 py-4'>
        <div className='flex flex-wrap items-center gap-2.5'>
          {[
            {
              icon: Star,
              label: 'Stars',
              value: formatNumber(repo.stargazersCount),
              textClass: 'text-amber-400',
              bgClass: 'bg-amber-400/[0.024]',
            },
            {
              icon: GitFork,
              label: 'Forks',
              value: formatNumber(repo.forksCount),
              textClass: 'text-blue-400',
              bgClass: 'bg-blue-400/[0.024]',
            },
            {
              icon: AlertCircle,
              label: 'Issues',
              value: formatNumber(repo.openIssuesCount),
              textClass: 'text-orange-400',
              bgClass: 'bg-orange-400/[0.024]',
            },
            {
              icon: Clock,
              label: 'Created',
              value: formatRelativeDate(repo.createdAt),
              textClass: 'text-green-400',
              bgClass: 'bg-green-400/[0.024]',
            },
            {
              icon: Clock,
              label: 'Updated',
              value: formatRelativeDate(repo.updatedAt),
              textClass: 'text-purple-400',
              bgClass: 'bg-purple-400/[0.024]',
            },
          ].map(stat => (
            <div
              key={stat.label}
              className={cn('flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-card/60', stat.bgClass)}
            >
              <stat.icon className={cn('h-3.5 w-3.5 opacity-60', stat.textClass)} />
              <div>
                <div className={cn('font-mono text-xs font-semibold leading-none', stat.textClass)}>
                  {stat.value}
                </div>
                <div className='text-muted-foreground/50 mt-1 text-[9px]'>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className='shrink-0 px-8 pb-4'>
          <div className='flex flex-wrap gap-1.5'>
            {repo.topics.map(topic => (
              <Badge
                key={topic}
                variant='outline'
                className='rounded-full border-blue-400/20 bg-blue-400/5 text-[10px] text-blue-400/80'
              >
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className='relative shrink-0 px-8 pb-2'>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            className='gap-2 bg-blue-400/15 text-blue-400 hover:bg-blue-400/25'
            onClick={() => openUrl(repo.htmlUrl)}
          >
            <ExternalLink className='h-3.5 w-3.5' />
            View on GitHub
          </Button>
          {repo.homepage && (
            <Button
              size='sm'
              variant='outline'
              className='gap-2 text-xs'
              onClick={() => openUrl(repo.homepage!)}
            >
              <BookOpen className='h-3.5 w-3.5' />
              Website
            </Button>
          )}
        </div>
        <div className='mt-3 h-px bg-gradient-to-r from-transparent via-border/25 to-transparent' />
      </div>

      {/* README */}
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='px-8 py-6'>
          {loadingReadme ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            </div>
          ) : readme !== null ? (
            <ReadmeContent readme={readme} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
