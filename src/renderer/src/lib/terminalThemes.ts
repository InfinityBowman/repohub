import type { ITheme } from '@xterm/xterm'

export const palenightTerminalTheme: ITheme = {
  background: '#1e2030',
  foreground: '#babed8',
  cursor: '#FFCB6B',
  cursorAccent: '#000000',
  selectionBackground: '#717CB450',
  black: '#000000',
  red: '#f07178',
  green: '#C3E88D',
  yellow: '#FFCB6B',
  blue: '#82AAFF',
  magenta: '#C792EA',
  cyan: '#89DDFF',
  white: '#ffffff',
  brightBlack: '#676E95',
  brightRed: '#f07178',
  brightGreen: '#C3E88D',
  brightYellow: '#FFCB6B',
  brightBlue: '#82AAFF',
  brightMagenta: '#C792EA',
  brightCyan: '#89DDFF',
  brightWhite: '#ffffff',
}

export const defaultTerminalTheme: ITheme = {
  background: '#1a1a1a',
  foreground: '#d4d4d4',
  cursor: '#aeafad',
  cursorAccent: '#000000',
  selectionBackground: '#26456850',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
}

export function getTerminalTheme(theme: string | undefined): ITheme {
  return theme === 'palenight' ? palenightTerminalTheme : defaultTerminalTheme
}
