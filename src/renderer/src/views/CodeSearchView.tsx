import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Database,
  RefreshCw,
  FileCode,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Download,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { useCodeSearch } from '@/hooks/useCodeSearch';
import { useRepositoryStore } from '@/store/repositoryStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { SearchResult } from '@/types';

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/20 text-yellow-300',
  typescript: 'bg-blue-500/20 text-blue-300',
  tsx: 'bg-blue-500/20 text-blue-300',
  python: 'bg-green-500/20 text-green-300',
  rust: 'bg-orange-500/20 text-orange-300',
  go: 'bg-cyan-500/20 text-cyan-300',
  java: 'bg-red-500/20 text-red-300',
  swift: 'bg-pink-500/20 text-pink-300',
};

const ALL_LANGUAGES = ['javascript', 'typescript', 'tsx', 'python', 'rust', 'go', 'java', 'swift'];

function ScoreBar({ score }: { score: number }) {
  const colorClass =
    score >= 70 ? 'bg-green-500'
    : score >= 50 ? 'bg-yellow-500'
    : 'bg-orange-500';
  return (
    <div className='bg-secondary h-2 w-12 overflow-hidden rounded-full'>
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function ResultCard({
  result,
  onOpenFile,
}: {
  result: SearchResult;
  onOpenFile: (r: SearchResult) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = result.chunk.code.split('\n');
  const isLong = lines.length > 15;
  const displayCode = expanded ? result.chunk.code : lines.slice(0, 15).join('\n');
  const scorePercent = Math.round(result.score * 100);

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-4'>
        <div className='mb-2 flex items-start justify-between gap-2'>
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline' className={LANGUAGE_COLORS[result.chunk.language] || ''}>
                {result.chunk.language}
              </Badge>
              <Badge variant='secondary'>{result.chunk.constructType}</Badge>
              {result.chunk.constructName !== '<anonymous>' &&
                result.chunk.constructName !== '<block>' && (
                  <span className='text-foreground font-mono text-sm font-medium'>
                    {result.chunk.constructName}
                  </span>
                )}
            </div>
            <button
              onClick={() => onOpenFile(result)}
              className='text-muted-foreground hover:text-foreground flex items-center gap-1 truncate text-left text-xs transition-colors'
            >
              <FileCode className='h-3 w-3 shrink-0' />
              <span className='truncate'>{result.chunk.relativePath}</span>
              <span className='shrink-0'>:{result.chunk.startLine}</span>
              <ExternalLink className='h-3 w-3 shrink-0' />
            </button>
          </div>
          <Tooltip>
              <TooltipTrigger>
                <div className='flex shrink-0 items-center gap-1'>
                  <ScoreBar score={scorePercent} />
                  <span className='text-muted-foreground w-8 text-right text-xs'>
                    {scorePercent}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Similarity: {scorePercent}%</TooltipContent>
            </Tooltip>
        </div>

        <div className='relative'>
          <pre className='bg-secondary/50 overflow-x-auto rounded-md p-3 text-xs leading-relaxed'>
            <code>{displayCode}</code>
          </pre>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className='text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs transition-colors'
            >
              {expanded ?
                <>
                  <ChevronUp className='h-3 w-3' /> Show less
                </>
              : <>
                  <ChevronDown className='h-3 w-3' /> Show all {lines.length} lines
                </>
              }
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CodeSearchView() {
  const { results, status, loading, error, modelProgress, search, startIndexing } = useCodeSearch();

  const repositories = useRepositoryStore(s => s.repositories);

  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState(0.4);
  const [scopeRepoPath, setScopeRepoPath] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const sortedRepos = useMemo(
    () => [...repositories].sort((a, b) => a.name.localeCompare(b.name)),
    [repositories],
  );

  const toggleLanguage = useCallback((lang: string) => {
    setSelectedLanguages(prev => {
      const next = new Set(prev);
      if (next.has(lang)) {
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  }, []);

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;
      search({
        query: searchQuery,
        limit: 30,
        minScore,
        languages: selectedLanguages.size > 0 ? Array.from(selectedLanguages) : undefined,
        directories: scopeRepoPath ? [scopeRepoPath] : undefined,
      });
    },
    [search, minScore, selectedLanguages, scopeRepoPath],
  );

  useEffect(() => {
    if (!query.trim()) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  const handleOpenFile = useCallback(async (result: SearchResult) => {
    const filePath = result.chunk.filePath;
    const line = result.chunk.startLine;
    const response = await window.electron.shell.openInVSCode(`${filePath}:${line}`);
    if (!response.success) {
      console.error('Failed to open file in VS Code:', response.error);
    }
  }, []);

  const isIdle = !status || status.state === 'idle';
  const isDownloading = status?.state === 'downloading-model';
  const isIndexing = status?.state === 'indexing';
  const isReady = status?.state === 'ready';
  const isError = status?.state === 'error';

  return (
    <div className='flex flex-col gap-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h2 className='text-xl font-semibold'>Code Search</h2>
          {isReady && status && (
            <span className='text-muted-foreground text-sm'>
              {status.totalChunks.toLocaleString()} chunks from{' '}
              {status.indexedFiles.toLocaleString()} files
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {(isReady || isIdle) && (
            <Button onClick={startIndexing} size='sm' variant='outline'>
              <RefreshCw className='h-4 w-4' />
              {isIdle ? 'Start Indexing' : 'Reindex'}
            </Button>
          )}
        </div>
      </div>

      {/* Model download progress */}
      {isDownloading && (
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <Download className='text-primary h-5 w-5 animate-pulse' />
              <div className='flex-1'>
                <div className='mb-1 flex items-center justify-between text-sm'>
                  <span>Downloading embedding model...</span>
                  {modelProgress && modelProgress.progress > 0 && (
                    <span className='text-muted-foreground'>
                      {Math.round(modelProgress.progress)}%
                    </span>
                  )}
                </div>
                <Progress value={modelProgress?.progress || 0} />
                <p className='text-muted-foreground mt-1 text-xs'>
                  all-MiniLM-L6-v2 (~80MB, one-time download)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indexing progress */}
      {isIndexing && status && (
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <Loader2 className='text-primary h-5 w-5 animate-spin' />
              <div className='flex-1'>
                <div className='mb-1 flex items-center justify-between text-sm'>
                  <span>
                    Indexing files... ({status.indexedFiles}/{status.totalFiles})
                  </span>
                  <span className='text-muted-foreground'>{status.progress}%</span>
                </div>
                <Progress value={status.progress} />
                {status.currentFile && (
                  <p className='text-muted-foreground mt-1 truncate text-xs'>
                    {status.currentFile}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {(isError || error) && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 p-4'>
            <AlertCircle className='text-destructive h-5 w-5' />
            <span className='text-destructive text-sm'>
              {error || status?.error || 'An error occurred'}
            </span>
          </CardContent>
        </Card>
      )}

      {/* No index yet */}
      {isIdle && !isDownloading && !isIndexing && (
        <div className='flex flex-col items-center gap-4 py-16 text-center'>
          <Database className='text-muted-foreground/50 h-12 w-12' />
          <div>
            <h3 className='text-lg font-medium'>No search index yet</h3>
            <p className='text-muted-foreground mt-1 text-sm'>
              Index your codebase to enable semantic code search.
              <br />
              This will download a local embedding model (~80MB) and parse your code.
            </p>
          </div>
          <Button onClick={startIndexing}>
            <Database className='h-4 w-4' />
            Start Indexing
          </Button>
        </div>
      )}

      {/* Search UI — show when ready or has results */}
      {(isReady || results.length > 0) && (
        <>
          {/* Search input */}
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search code semantically... (e.g. 'function that handles authentication')"
                className='pl-10'
              />
            </div>
            {loading && <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />}
          </div>

          {/* Filters row */}
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
            {/* Repo scope */}
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <FolderOpen className='h-3.5 w-3.5' />
              <Select
                value={scopeRepoPath || '__all__'}
                onValueChange={v => setScopeRepoPath(v === '__all__' ? '' : v)}
              >
                <SelectTrigger size='sm' className='h-7 w-auto min-w-[140px] text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All repositories</SelectItem>
                  {sortedRepos.map(repo => (
                    <SelectItem key={repo.id} value={repo.path}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min similarity */}
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <span>Min similarity:</span>
              <Slider
                value={[minScore * 100]}
                onValueChange={([v]) => setMinScore(v / 100)}
                min={10}
                max={90}
                step={5}
                className='w-24'
              />
              <span className='w-8 text-right'>{Math.round(minScore * 100)}%</span>
            </div>
          </div>

          {/* Language filter chips */}
          <div className='flex flex-wrap items-center gap-1.5'>
            <span className='text-muted-foreground mr-1 text-xs'>Languages:</span>
            {ALL_LANGUAGES.map(lang => {
              const active = selectedLanguages.has(lang);
              return (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    active ?
                      LANGUAGE_COLORS[lang] || 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
            {selectedLanguages.size > 0 && (
              <button
                onClick={() => setSelectedLanguages(new Set())}
                className='text-muted-foreground hover:text-foreground ml-1 text-xs'
              >
                clear
              </button>
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className='flex flex-col gap-3'>
              <span className='text-muted-foreground text-sm'>
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              {results.map(result => (
                <ResultCard key={result.chunk.id} result={result} onOpenFile={handleOpenFile} />
              ))}
            </div>
          )}

          {/* No results for search */}
          {query.trim() && !loading && results.length === 0 && (
            <div className='text-muted-foreground py-8 text-center'>
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </>
      )}
    </div>
  );
}
