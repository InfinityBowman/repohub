import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useConfig } from '@/hooks/useConfig'
import { getTerminalTheme } from '@/lib/terminalThemes'

interface ScaffoldTerminalProps {
  onDone: (data: { exitCode: number; projectName: string }) => void
  disabled?: boolean
}

export function ScaffoldTerminal({ onDone, disabled }: ScaffoldTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const disabledRef = useRef(disabled)
  const { config } = useConfig()

  // Keep ref in sync so the onData handler sees the latest value
  disabledRef.current = disabled

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: getTerminalTheme(config?.theme),
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, Courier New, monospace',
      cursorBlink: true,
      disableStdin: false,
      scrollback: 5000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.electron.shell.openUrl(uri)
    })
    terminal.loadAddon(webLinksAddon)

    terminal.open(containerRef.current)

    try {
      fitAddon.fit()
    } catch {
      // Container might not be visible yet
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Forward user input to PTY (only when not disabled)
    terminal.onData((data) => {
      if (!disabledRef.current) {
        window.electron.scaffold.write(data)
      }
    })

    // Listen for scaffold output
    const unsubOutput = window.electron.on.scaffoldOutput((data) => {
      terminal.write(data.data)
    })

    // Listen for scaffold done
    const unsubDone = window.electron.on.scaffoldDone((data) => {
      onDone(data)
    })

    // Resize observer
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        if (!disabledRef.current) {
          window.electron.scaffold.resize(terminal.cols, terminal.rows)
        }
      } catch {
        // Ignore
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      unsubOutput()
      unsubDone()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [onDone])

  // Hide cursor when disabled
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.cursorBlink = !disabled
      terminalRef.current.options.disableStdin = !!disabled
    }
  }, [disabled])

  // Update terminal theme when config changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTerminalTheme(config?.theme)
    }
  }, [config?.theme])

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-md border border-border bg-[#0a0a0a] p-2"
    />
  )
}
