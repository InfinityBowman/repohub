import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  return (
    <div className={cn('markdown-body prose prose-sm max-w-none', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ href, children: linkChildren }) => (
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
                  } catch {
                    /* relative link, ignore */
                  }
                }
              }}
            >
              {linkChildren}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
