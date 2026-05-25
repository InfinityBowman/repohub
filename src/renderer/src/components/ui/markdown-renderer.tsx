import { useEffect, useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { codeToHtml, type BundledLanguage } from 'shiki';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  children: string;
  className?: string;
  /** GitHub repo URL (e.g. https://github.com/owner/repo) for resolving relative URLs */
  baseUrl?: string;
}

/** Extract owner/repo from a GitHub URL */
function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/** Resolve a possibly-relative image URL to an absolute raw.githubusercontent.com URL */
function resolveImageUrl(
  src: string | undefined,
  repoInfo: { owner: string; repo: string } | null,
): string | undefined {
  if (!src) return undefined;

  // Already absolute — convert GitHub blob URLs to raw
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const blobMatch = src.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)/,
    );
    if (blobMatch) {
      return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}`;
    }
    return src;
  }

  // Data URIs, other protocols
  if (src.includes('://') || src.startsWith('data:')) return src;

  // Anchors
  if (src.startsWith('#')) return src;

  // Relative URL — resolve against GitHub raw
  if (repoInfo) {
    const cleanPath = src.replace(/^\.\//, '').replace(/^\//, '');
    return `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/HEAD/${cleanPath}`;
  }

  return src;
}

/** Resolve a relative link href to a GitHub blob URL */
function resolveLinkUrl(
  href: string | undefined,
  repoInfo: { owner: string; repo: string } | null,
): string | undefined {
  if (!href) return undefined;

  // Already absolute
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  // Mailto
  if (href.startsWith('mailto:')) return href;
  // Anchors — don't navigate
  if (href.startsWith('#')) return undefined;

  // Relative URL — resolve to GitHub blob view
  if (repoInfo) {
    const cleanPath = href.replace(/^\.\//, '').replace(/^\//, '');
    return `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/HEAD/${cleanPath}`;
  }

  return href;
}

// Detect the app's shiki theme from the document class
function getShikiTheme(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('palenight')) {
    return 'material-theme-palenight';
  }
  return 'github-dark-default';
}

function ShikiCode({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;
    const theme = getShikiTheme();
    codeToHtml(code, { lang: lang as BundledLanguage, theme })
      .then(h => {
        if (!cancelled) setHtml(h);
      })
      .catch(() => {
        codeToHtml(code, { lang: 'text', theme })
          .then(h => {
            if (!cancelled) setHtml(h);
          })
          .catch(() => {
            /* give up, show fallback */
          });
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }

  return <div className='shiki-block' dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MarkdownRenderer({ children, className, baseUrl }: MarkdownRendererProps) {
  const repoInfo = useMemo(() => (baseUrl ? parseGitHubRepo(baseUrl) : null), [baseUrl]);

  return (
    <div className={cn('markdown-body prose prose-sm max-w-none', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ href, children: linkChildren }) => {
            const resolved = resolveLinkUrl(href, repoInfo);
            return (
              <a
                href={resolved || href}
                onClick={e => {
                  e.preventDefault();
                  const url = resolved || href;
                  if (url) {
                    try {
                      const parsed = new URL(url);
                      if (['http:', 'https:'].includes(parsed.protocol)) {
                        window.electron.shell.openUrl(url);
                      }
                    } catch {
                      /* relative link, ignore */
                    }
                  }
                }}
              >
                {linkChildren}
              </a>
            );
          },
          img: ({ src, alt, ...props }) => {
            const resolvedSrc = resolveImageUrl(src, repoInfo);
            return (
              <img
                src={resolvedSrc}
                alt={alt || ''}
                loading='lazy'
                {...props}
                onError={e => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            );
          },
          // Handle <source> inside <picture> elements for dark/light mode images
          source: ({ srcSet, ...props }) => {
            const resolvedSrcSet = srcSet
              ? srcSet
                  .split(',')
                  .map(entry => {
                    const parts = entry.trim().split(/\s+/);
                    const url = resolveImageUrl(parts[0], repoInfo);
                    return [url, ...parts.slice(1)].join(' ');
                  })
                  .join(', ')
              : undefined;
            return <source srcSet={resolvedSrcSet} {...props} />;
          },
          // Unwrap <pre> when child is a highlighted code block (ShikiCode provides its own <pre>)
          pre: ({ children: preChildren, node }) => {
            const codeChild = node?.children?.find(
              (c): c is import('hast').Element =>
                c.type === 'element' && c.tagName === 'code',
            );
            const classes = (codeChild?.properties?.className as string[]) || [];
            const hasLang = classes.some(
              c => typeof c === 'string' && c.startsWith('language-'),
            );
            if (hasLang) {
              return <>{preChildren}</>;
            }
            return <pre>{preChildren}</pre>;
          },
          code: ({ className: codeClassName, children: codeChildren, ...rest }) => {
            const match = /language-(\w+)/.exec(codeClassName || '');
            if (match) {
              const code = String(codeChildren).replace(/\n$/, '');
              return <ShikiCode code={code} lang={match[1]} />;
            }
            return (
              <code className={codeClassName} {...rest}>
                {codeChildren}
              </code>
            );
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
