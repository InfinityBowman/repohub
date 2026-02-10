import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useProcesses } from '@/hooks/useProcesses';
import { useProcessStore } from '@/store/processStore';
import { useConfig } from '@/hooks/useConfig';
import { getTerminalTheme } from '@/lib/terminalThemes';

interface TerminalOutputProps {
  repoId: string;
  data: string;
  interactive?: boolean;
}

export function TerminalOutput({ repoId, data, interactive = false }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastDataLengthRef = useRef(0);
  const { resize, write } = useProcesses();
  const { config } = useConfig();

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: getTerminalTheme(config?.theme),
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, Courier New, monospace',
      cursorBlink: interactive,
      disableStdin: !interactive,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Handle full URLs (http://localhost:3000, etc.)
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.electron.shell.openUrl(uri);
    });
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);

    // Custom link provider for bare localhost:PORT and 127.0.0.1:PORT
    const localhostRegex = /(?:localhost|127\.0\.0\.1):(\d{2,5})(\/\S*)?/g;
    terminal.registerLinkProvider({
      provideLinks(lineNumber, callback) {
        const line = terminal.buffer.active.getLine(lineNumber - 1);
        if (!line) return callback(undefined);

        const text = line.translateToString();
        const links: any[] = [];
        let match: RegExpExecArray | null;

        localhostRegex.lastIndex = 0;
        while ((match = localhostRegex.exec(text)) !== null) {
          const startCol = match.index + 1;
          const length = match[0].length;
          const url = `http://${match[0]}`;
          links.push({
            range: {
              start: { x: startCol, y: lineNumber },
              end: { x: startCol + length, y: lineNumber },
            },
            text: url,
            activate() {
              window.electron.shell.openUrl(url);
            },
          });
        }

        callback(links.length > 0 ? links : undefined);
      },
    });

    // Send keystrokes to the PTY when interactive
    if (interactive) {
      terminal.onData((data) => {
        write(repoId, data);
      });
    }

    // Fit terminal to container
    try {
      fitAddon.fit();
    } catch {
      // Container might not be visible yet
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    lastDataLengthRef.current = 0;

    // Load saved log if no data in memory yet, otherwise write existing data
    if (data) {
      terminal.write(data);
      lastDataLengthRef.current = data.length;
    } else {
      window.electron.logs.get(repoId).then(savedLog => {
        if (savedLog && terminalRef.current) {
          terminalRef.current.write(savedLog);
          lastDataLengthRef.current = savedLog.length;
          useProcessStore.getState().appendOutput(repoId, savedLog);
        }
      });
    }

    // Resize observer
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        resize(repoId, terminal.cols, terminal.rows);
      } catch {
        // Ignore errors during resize
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastDataLengthRef.current = 0;
    };
  }, [repoId, interactive]);

  // Write new data incrementally
  useEffect(() => {
    if (!terminalRef.current) return;
    if (data.length > lastDataLengthRef.current) {
      const newData = data.slice(lastDataLengthRef.current);
      terminalRef.current.write(newData);
      lastDataLengthRef.current = data.length;
    }
  }, [data]);

  // Update terminal theme when config changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTerminalTheme(config?.theme);
    }
  }, [config?.theme]);

  const bg = getTerminalTheme(config?.theme).background;

  return (
    <div
      ref={containerRef}
      className='border-border h-64 w-full overflow-hidden rounded-md border p-2'
      style={{ backgroundColor: bg }}
    />
  );
}
