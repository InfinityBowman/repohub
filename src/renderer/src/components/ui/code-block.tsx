import { useEffect, useState } from 'react';
import { codeToHtml, type BundledLanguage } from 'shiki';

interface CodeBlockProps {
  code: string;
  lang?: string;
  theme?: string;
}

const themeMap: Record<string, string> = {
  palenight: 'material-theme-palenight',
  default: 'github-dark-default',
};

export function CodeBlock({ code, lang = 'json', theme = 'default' }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    const shikiTheme = themeMap[theme] || themeMap.default;
    codeToHtml(code, { lang: lang as BundledLanguage, theme: shikiTheme }).then(setHtml).catch(() => {
      // Fallback if lang isn't a valid shiki language
      codeToHtml(code, { lang: 'text', theme: shikiTheme }).then(setHtml);
    });
  }, [code, lang, theme]);

  if (!html) {
    return (
      <pre className='border-border text-muted-foreground max-h-96 overflow-auto rounded-md border bg-black p-4 font-mono text-xs'>
        {code}
      </pre>
    );
  }

  return (
    <div
      className='[&_pre]:border-border [&_pre]:max-h-96 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs'
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
