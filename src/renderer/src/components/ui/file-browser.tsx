import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { codeToHtml } from 'shiki';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  Lock,
  Settings,
  Loader2,
  FolderTree,
  Info,
  HardDrive,
  Hash,
  FileType,
  ChevronsRight,
} from 'lucide-react';
import type { FileNode } from '@/types';

// ─── Language detection ─────────────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  swift: 'swift',
  kt: 'kotlin',
  rb: 'ruby',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  vue: 'vue',
  svelte: 'svelte',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
};

function detectLanguage(filePath: string): string {
  const name = filePath.split('/').pop() || '';
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANG[ext] || 'text';
}

// ─── File icon & color helpers ──────────────────────────────────

function getFileIcon(name: string, isDir: boolean, isExpanded?: boolean) {
  if (isDir) return isExpanded ? FolderOpen : Folder;
  const lower = name.toLowerCase();
  if (lower === '.env' || lower.startsWith('.env.')) return Lock;
  if (
    lower === '.gitignore' ||
    lower.endsWith('.config.ts') ||
    lower.endsWith('.config.js') ||
    lower.endsWith('.config.mjs') ||
    lower.endsWith('.config.cjs')
  )
    return Settings;
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.py') ||
    lower.endsWith('.rs') ||
    lower.endsWith('.go') ||
    lower.endsWith('.java') ||
    lower.endsWith('.swift') ||
    lower.endsWith('.rb') ||
    lower.endsWith('.c') ||
    lower.endsWith('.cpp') ||
    lower.endsWith('.h')
  )
    return FileCode2;
  return FileText;
}

function getFileIconColor(name: string, isDir: boolean): string {
  if (isDir) return 'text-amber-400';
  const lower = name.toLowerCase();
  if (lower === '.env' || lower.startsWith('.env.')) return 'text-amber-400';
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.toml')
  )
    return 'text-amber-400';
  if (lower.endsWith('.md')) return 'text-blue-400';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text-blue-400';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'text-green-400';
  if (lower.endsWith('.py')) return 'text-green-400';
  if (lower.endsWith('.rs')) return 'text-orange-400';
  if (lower.endsWith('.go')) return 'text-teal-400';
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'text-purple-400';
  if (lower === '.gitignore') return 'text-slate-400';
  return 'text-slate-400';
}

// ─── Highlighted code viewer with cache support ─────────────────

function HighlightedCode({
  code,
  lang,
  cachedHtml,
  onHighlighted,
}: {
  code: string;
  lang: string;
  cachedHtml: string | null;
  onHighlighted?: (html: string) => void;
}) {
  const [html, setHtml] = useState<string | null>(cachedHtml);
  const callbackRef = useRef(onHighlighted);
  callbackRef.current = onHighlighted;

  useEffect(() => {
    if (cachedHtml) {
      setHtml(cachedHtml);
      return;
    }
    setHtml(null);
    let cancelled = false;
    codeToHtml(code, { lang, theme: 'material-theme-palenight' })
      .then(result => {
        if (!cancelled) {
          setHtml(result);
          callbackRef.current?.(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const fallback = `<pre style="padding:1rem;font-size:12px;"><code>${escaped}</code></pre>`;
          setHtml(fallback);
          callbackRef.current?.(fallback);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang, cachedHtml]);

  if (html === null) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center'>
        <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
      </div>
    );
  }

  return (
    <div
      className='min-h-0 flex-1 overflow-auto [&_pre]:!max-h-none [&_pre]:!rounded-none [&_pre]:!border-0 [&_pre]:!p-4 [&_pre]:font-mono [&_pre]:text-xs'
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── File tree node ─────────────────────────────────────────────

function FileTreeNode({
  node,
  level,
  expandedDirs,
  dirFiles,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onHoverFile,
  onHoverLeave,
}: {
  node: FileNode;
  level: number;
  expandedDirs: Set<string>;
  dirFiles: Record<string, FileNode[]>;
  selectedPath: string | null;
  onToggleDir: (relativePath: string) => void;
  onSelectFile: (relativePath: string) => void;
  onHoverFile?: (relativePath: string) => void;
  onHoverLeave?: () => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const children = dirFiles[node.path];
  const Icon = getFileIcon(node.name, node.type === 'directory', isExpanded);
  const iconColor = getFileIconColor(node.name, node.type === 'directory');

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          className='hover:bg-secondary/40 flex w-full items-center gap-1.5 rounded-sm py-1 text-left text-[11px] transition-colors'
          style={{ paddingLeft: level * 14 + 8 }}
        >
          <ChevronRight
            className={cn(
              'text-muted-foreground/50 h-3 w-3 shrink-0 transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          />
          <Icon className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
          <span className='text-foreground/70 truncate'>{node.name}</span>
        </button>
        {isExpanded && children && (
          <div>
            {children.map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                expandedDirs={expandedDirs}
                dirFiles={dirFiles}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onHoverFile={onHoverFile}
                onHoverLeave={onHoverLeave}
              />
            ))}
          </div>
        )}
        {isExpanded && !children && (
          <div
            className='text-muted-foreground/50 flex items-center gap-1.5 py-1 text-[10px]'
            style={{ paddingLeft: (level + 1) * 14 + 8 }}
          >
            <Loader2 className='h-3 w-3 animate-spin' />
            Loading...
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      onMouseEnter={() => onHoverFile?.(node.path)}
      onMouseLeave={onHoverLeave}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-sm py-1 text-left text-[11px] transition-colors',
        isSelected ?
          'bg-blue-400/10 text-blue-400'
        : 'text-foreground/70 hover:bg-secondary/40 hover:text-foreground/80',
      )}
      style={{ paddingLeft: level * 14 + 8 }}
    >
      {/* Spacing to align with directory chevrons */}
      <span className='w-3 shrink-0' />
      <Icon className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-blue-400' : iconColor)} />
      <span className='truncate'>{node.name}</span>
    </button>
  );
}

// ─── Breadcrumb header ──────────────────────────────────────────

function EditorBreadcrumb({
  filePath,
  infoOpen,
  onToggleInfo,
}: {
  filePath: string;
  infoOpen: boolean;
  onToggleInfo: () => void;
}) {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const Icon = getFileIcon(fileName, false);
  const iconColor = getFileIconColor(fileName, false);

  return (
    <div className='border-border/30 bg-card/50 flex shrink-0 items-center justify-between border-b px-3 py-2'>
      <div className='flex min-w-0 items-center gap-1 text-[11px]'>
        {parts.map((part, i) => (
          <span key={i} className='flex items-center gap-1'>
            {i > 0 && <ChevronRight className='text-muted-foreground/50 h-3 w-3 shrink-0' />}
            {i === parts.length - 1 ?
              <span className='flex items-center gap-1.5'>
                <Icon className={cn('h-3 w-3 shrink-0', iconColor)} />
                <span className='text-foreground font-medium'>{part}</span>
              </span>
            : <span className='text-muted-foreground'>{part}</span>}
          </span>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleInfo}
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
              infoOpen ?
                'bg-blue-400/15 text-blue-400'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {infoOpen ?
              <ChevronsRight className='h-3.5 w-3.5' />
            : <Info className='h-3.5 w-3.5' />}
          </button>
        </TooltipTrigger>
        <TooltipContent className='text-xs'>
          {infoOpen ? 'Hide file info' : 'Show file info'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── File info sidebar ──────────────────────────────────────────

function formatFileSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileInfoSidebar({ filePath, content }: { filePath: string; content: string }) {
  const fileName = filePath.split('/').pop() || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'FILE' : 'FILE';
  const lineCount = content.split('\n').length;
  const fileSize = formatFileSize(content);
  const lang = detectLanguage(filePath);

  const items = useMemo(
    () => [
      { icon: FileType, label: 'Type', value: ext },
      { icon: Hash, label: 'Lines', value: String(lineCount) },
      { icon: HardDrive, label: 'Size', value: fileSize },
      { icon: FileCode2, label: 'Lang', value: lang === 'text' ? 'Plain text' : lang },
    ],
    [ext, lineCount, fileSize, lang],
  );

  return (
    <div className='border-border/50 bg-card/30 flex w-52 shrink-0 flex-col overflow-y-auto border-l'>
      <div className='border-border/30 border-b px-3 py-2'>
        <span className='text-muted-foreground font-mono text-[10px] tracking-wider uppercase'>
          File Info
        </span>
      </div>
      <div className='space-y-0.5 p-2'>
        {items.map(item => (
          <div key={item.label} className='flex items-center gap-2 rounded-md px-2 py-1.5 text-xs'>
            <item.icon className='text-muted-foreground h-3 w-3 shrink-0' />
            <span className='text-muted-foreground'>{item.label}</span>
            <span className='text-foreground ml-auto font-mono text-[11px]'>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FileBrowser ─────────────────────────────────────────────────

export interface FileBrowserProps {
  /** Fetch directory listing for a relative path ('' for root). */
  listFiles: (relativePath: string) => Promise<FileNode[]>;
  /** Read file content by relative path. */
  readFile: (relativePath: string) => Promise<string>;
  /** Optional header rendered above the split layout. */
  header?: ReactNode;
  /** Additional classes on root element. */
  className?: string;
  /** File tree panel width in pixels. Default: 220. */
  treeWidth?: number;
}

export function FileBrowser({
  listFiles,
  readFile,
  header,
  className,
  treeWidth = 220,
}: FileBrowserProps) {
  // ─── UI state ───────────────────────────────────────────
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirFiles, setDirFiles] = useState<Record<string, FileNode[]>>({});
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // ─── Caches (refs — no re-renders) ─────────────────────
  const dirFilesRef = useRef<Record<string, FileNode[]>>({});
  const loadingDirs = useRef(new Set<string>());
  const contentCache = useRef(new Map<string, string>());
  const htmlCache = useRef(new Map<string, string>());
  const prefetchingPaths = useRef(new Set<string>());
  const prefetchTimer = useRef<ReturnType<typeof setTimeout>>();
  const rootLoaded = useRef(false);

  // Helper: update dirFiles state + ref together
  const updateDirFiles = useCallback((key: string, files: FileNode[]) => {
    dirFilesRef.current[key] = files;
    setDirFiles(prev => ({ ...prev, [key]: files }));
  }, []);

  // ─── Load root directory on mount ──────────────────────
  useEffect(() => {
    if (rootLoaded.current) return;
    rootLoaded.current = true;
    listFiles('')
      .then(files => updateDirFiles('', files))
      .catch(() => {});
  }, [listFiles, updateDirFiles]);

  // ─── Cleanup prefetch timer ────────────────────────────
  useEffect(() => {
    return () => {
      if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    };
  }, []);

  // ─── Directory toggle ──────────────────────────────────
  const handleToggleDir = useCallback(
    (relativePath: string) => {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        if (next.has(relativePath)) next.delete(relativePath);
        else next.add(relativePath);
        return next;
      });

      // Load children if not cached and not already loading
      if (!dirFilesRef.current[relativePath] && !loadingDirs.current.has(relativePath)) {
        loadingDirs.current.add(relativePath);
        listFiles(relativePath)
          .then(files => {
            loadingDirs.current.delete(relativePath);
            updateDirFiles(relativePath, files);
          })
          .catch(() => {
            loadingDirs.current.delete(relativePath);
          });
      }
    },
    [listFiles, updateDirFiles],
  );

  // ─── File selection ────────────────────────────────────
  const handleSelectFile = useCallback(
    async (relativePath: string) => {
      // Instant from content cache
      const cached = contentCache.current.get(relativePath);
      if (cached) {
        setSelectedFile({ path: relativePath, content: cached });
        return;
      }

      setLoadingFile(true);
      try {
        const content = await readFile(relativePath);
        contentCache.current.set(relativePath, content);
        setSelectedFile({ path: relativePath, content });
      } catch {
        // Silent fail — file may be binary or too large
      } finally {
        setLoadingFile(false);
      }
    },
    [readFile],
  );

  // ─── Hover prefetch (content + highlight) ──────────────
  const prefetchFile = useCallback(
    async (relativePath: string) => {
      if (contentCache.current.has(relativePath) && htmlCache.current.has(relativePath)) return;
      if (prefetchingPaths.current.has(relativePath)) return;

      prefetchingPaths.current.add(relativePath);
      try {
        let content = contentCache.current.get(relativePath);
        if (!content) {
          content = await readFile(relativePath);
          contentCache.current.set(relativePath, content);
        }
        if (!htmlCache.current.has(relativePath)) {
          const lang = detectLanguage(relativePath);
          try {
            const highlighted = await codeToHtml(content, {
              lang,
              theme: 'material-theme-palenight',
            });
            htmlCache.current.set(relativePath, highlighted);
          } catch {
            const escaped = content
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            htmlCache.current.set(
              relativePath,
              `<pre style="padding:1rem;font-size:12px;"><code>${escaped}</code></pre>`,
            );
          }
        }
      } catch {
        // Prefetch failure is not critical
      } finally {
        prefetchingPaths.current.delete(relativePath);
      }
    },
    [readFile],
  );

  const handleHoverFile = useCallback(
    (relativePath: string) => {
      if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
      prefetchTimer.current = setTimeout(() => prefetchFile(relativePath), 150);
    },
    [prefetchFile],
  );

  const handleHoverLeave = useCallback(() => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
  }, []);

  // ─── Highlight cache callback ──────────────────────────
  const handleHighlighted =
    selectedFile ? (html: string) => htmlCache.current.set(selectedFile.path, html) : undefined;

  // ─── Derived values ────────────────────────────────────
  const rootFiles = dirFiles[''];
  const fileLang = selectedFile ? detectLanguage(selectedFile.path) : 'text';
  const cachedHtml = selectedFile ? htmlCache.current.get(selectedFile.path) || null : null;

  return (
    <div
      className={cn(
        'border-border/50 flex h-full flex-col overflow-hidden rounded-lg border',
        className,
      )}
    >
      {/* Optional header */}
      {header && <div className='border-border/30 shrink-0 border-b px-3 py-2'>{header}</div>}

      {/* Split layout: tree + viewer */}
      <div className='flex min-h-0 flex-1'>
        {/* File tree panel */}
        <div
          className='border-border/50 bg-card/30 flex shrink-0 flex-col overflow-hidden border-r'
          style={{ width: treeWidth }}
        >
          {/* Explorer header */}
          <div className='border-border/30 flex shrink-0 items-center gap-1.5 border-b px-3 py-2'>
            <FolderTree className='text-muted-foreground h-3 w-3' />
            <span className='text-muted-foreground font-mono text-[10px] tracking-wider uppercase'>
              Explorer
            </span>
          </div>
          {/* Tree nodes */}
          <div className='flex-1 overflow-y-auto py-1'>
            {rootFiles ?
              rootFiles.map(node => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  level={0}
                  expandedDirs={expandedDirs}
                  dirFiles={dirFiles}
                  selectedPath={selectedFile?.path || null}
                  onToggleDir={handleToggleDir}
                  onSelectFile={handleSelectFile}
                  onHoverFile={handleHoverFile}
                  onHoverLeave={handleHoverLeave}
                />
              ))
            : <div className='flex items-center justify-center py-4'>
                <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
              </div>
            }
          </div>
        </div>

        {/* Code viewer */}
        <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
          {loadingFile ?
            <div className='flex flex-1 items-center justify-center'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            </div>
          : selectedFile ?
            <>
              <EditorBreadcrumb
                filePath={selectedFile.path}
                infoOpen={infoOpen}
                onToggleInfo={() => setInfoOpen(o => !o)}
              />
              <div className='flex min-h-0 flex-1'>
                <HighlightedCode
                  code={selectedFile.content}
                  lang={fileLang}
                  cachedHtml={cachedHtml}
                  onHighlighted={handleHighlighted}
                />
                {/* File info sidebar — slides in */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    infoOpen ? 'w-52' : 'w-0',
                  )}
                >
                  {infoOpen && (
                    <FileInfoSidebar filePath={selectedFile.path} content={selectedFile.content} />
                  )}
                </div>
              </div>
            </>
          : <div className='flex flex-1 items-center justify-center'>
              <div className='text-center'>
                <FileCode2 className='text-muted-foreground/20 mx-auto mb-2 h-8 w-8' />
                <p className='text-muted-foreground/50 text-xs'>Select a file to view</p>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  );
}
