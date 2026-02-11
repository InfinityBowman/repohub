import { useMemo, useEffect, useState } from 'react';
import { diffLines, type Change } from 'diff';
import { codeToTokens, type ThemedToken } from 'shiki';

const SHIKI_THEME = 'github-dark-default';

// --- Language detection from file path ---

const extToLang: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  cs: 'csharp',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  vue: 'vue',
  svelte: 'svelte',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'mdx',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  dockerfile: 'dockerfile',
  graphql: 'graphql',
  xml: 'xml',
  svg: 'xml',
};

function langFromPath(filePath?: string): string {
  if (!filePath) return 'text';
  const name = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (name === 'dockerfile') return 'dockerfile';
  const ext = name.split('.').pop() ?? '';
  return extToLang[ext] || 'text';
}

// --- Diff computation ---

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
  /** Index into the source array (old for removed, new for added/unchanged) */
  sourceLineIndex: number;
}

function computeDiffLines(oldCode: string, newCode: string): DiffLine[] {
  const changes: Change[] = diffLines(oldCode, newCode);
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;
  // Track indices into the original old/new line arrays for token mapping
  let oldIdx = 0;
  let newIdx = 0;

  for (const change of changes) {
    const rawLines = change.value.split('\n');
    if (rawLines[rawLines.length - 1] === '') rawLines.pop();

    for (const text of rawLines) {
      if (change.added) {
        lines.push({
          type: 'added',
          content: text,
          newLineNo: newLine++,
          sourceLineIndex: newIdx++,
        });
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: text,
          oldLineNo: oldLine++,
          sourceLineIndex: oldIdx++,
        });
      } else {
        lines.push({
          type: 'unchanged',
          content: text,
          oldLineNo: oldLine++,
          newLineNo: newLine++,
          sourceLineIndex: newIdx,
        });
        oldIdx++;
        newIdx++;
      }
    }
  }

  return lines;
}

// --- Shiki tokenization hook ---

function useTokenizedLines(code: string, lang: string): ThemedToken[][] | null {
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    codeToTokens(code, { lang, theme: SHIKI_THEME })
      .then(result => {
        if (!cancelled) setTokens(result.tokens);
      })
      .catch(() => {
        if (!cancelled) setTokens(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return !code ? [] : tokens;
}

// --- Token rendering ---

function TokenizedContent({ tokens }: { tokens?: ThemedToken[] }) {
  if (!tokens || tokens.length === 0) return <>{'\u00A0'}</>;
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} style={token.color ? { color: token.color } : undefined}>
          {token.content}
        </span>
      ))}
    </>
  );
}

// --- Styles ---

const rowBg = {
  added: 'bg-green-500/15',
  removed: 'bg-red-500/12',
  unchanged: '',
} as const;

const gutterStyles = {
  added: 'text-green-500/60',
  removed: 'text-red-500/60',
  unchanged: 'text-muted-foreground/40',
} as const;

const prefixMap = {
  added: '+',
  removed: '-',
  unchanged: ' ',
} as const;

// --- DiffViewer ---

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
  fileName?: string;
  lang?: string;
}

export function DiffViewer({ oldCode, newCode, fileName, lang }: DiffViewerProps) {
  const resolvedLang = lang || langFromPath(fileName);
  const lines = useMemo(() => computeDiffLines(oldCode, newCode), [oldCode, newCode]);

  const oldTokens = useTokenizedLines(oldCode, resolvedLang);
  const newTokens = useTokenizedLines(newCode, resolvedLang);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of lines) {
      if (line.type === 'added') added++;
      if (line.type === 'removed') removed++;
    }
    return { added, removed };
  }, [lines]);

  return (
    <div className='border-border overflow-hidden rounded-md border bg-black'>
      {/* Header */}
      {fileName && (
        <div className='border-border bg-muted/30 flex items-center justify-between border-b px-3 py-1.5'>
          <span className='text-muted-foreground truncate font-mono text-xs'>{fileName}</span>
          <div className='flex items-center gap-2 text-[10px] font-medium'>
            {stats.added > 0 && <span className='text-green-400'>+{stats.added}</span>}
            {stats.removed > 0 && <span className='text-red-400'>-{stats.removed}</span>}
          </div>
        </div>
      )}

      {/* Diff body */}
      <div className='max-h-96 overflow-auto'>
        <table className='w-full border-collapse font-mono text-xs leading-5'>
          <tbody>
            {lines.map((line, i) => {
              const tokenSource = line.type === 'removed' ? oldTokens : newTokens;
              const lineTokens = tokenSource?.[line.sourceLineIndex];

              return (
                <tr key={i} className={rowBg[line.type]}>
                  <td
                    className={`w-[1px] min-w-8 px-2 text-right whitespace-nowrap select-none ${gutterStyles[line.type]}`}
                  >
                    {line.oldLineNo ?? ''}
                  </td>
                  <td
                    className={`w-[1px] min-w-8 px-2 text-right whitespace-nowrap select-none ${gutterStyles[line.type]}`}
                  >
                    {line.newLineNo ?? ''}
                  </td>
                  <td
                    className={`w-[1px] px-1 text-center whitespace-nowrap select-none ${gutterStyles[line.type]}`}
                  >
                    {prefixMap[line.type]}
                  </td>
                  <td className='px-2 py-px break-all whitespace-pre-wrap'>
                    {lineTokens ?
                      <TokenizedContent tokens={lineTokens} />
                    : line.content || '\u00A0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer stats (only when no header) */}
      {!fileName && (stats.added > 0 || stats.removed > 0) && (
        <div className='border-border flex items-center gap-2 border-t px-3 py-1 text-[10px] font-medium'>
          {stats.added > 0 && <span className='text-green-400'>+{stats.added}</span>}
          {stats.removed > 0 && <span className='text-red-400'>-{stats.removed}</span>}
        </div>
      )}
    </div>
  );
}

// --- NewContentViewer ---

export function NewContentViewer({ content, fileName }: { content: string; fileName?: string }) {
  const lang = langFromPath(fileName);
  const tokens = useTokenizedLines(content, lang);

  const lines = useMemo(() => {
    const raw = content.split('\n');
    if (raw[raw.length - 1] === '') raw.pop();
    return raw;
  }, [content]);

  return (
    <div className='border-border overflow-hidden rounded-md border bg-black'>
      {fileName && (
        <div className='border-border bg-muted/30 flex items-center justify-between border-b px-3 py-1.5'>
          <span className='text-muted-foreground truncate font-mono text-xs'>{fileName}</span>
          <span className='text-[10px] font-medium text-green-400'>+{lines.length} (new file)</span>
        </div>
      )}
      <div className='max-h-96 overflow-auto'>
        <table className='w-full border-collapse font-mono text-xs leading-5'>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className='bg-green-500/10'>
                <td className='w-[1px] min-w-8 px-2 text-right whitespace-nowrap text-green-500/60 select-none'>
                  {i + 1}
                </td>
                <td className='w-[1px] px-1 text-center whitespace-nowrap text-green-500/60 select-none'>
                  +
                </td>
                <td className='px-2 py-px break-all whitespace-pre-wrap'>
                  {tokens?.[i] ?
                    <TokenizedContent tokens={tokens[i]} />
                  : line || '\u00A0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
