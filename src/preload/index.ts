import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  repositories: {
    scan: () => ipcRenderer.invoke('repo:scan'),
    rescan: () => ipcRenderer.invoke('repo:rescan'),
    getById: (id: string) => ipcRenderer.invoke('repo:get-by-id', id),
  },

  processes: {
    start: (repoId: string, command?: string) =>
      ipcRenderer.invoke('process:start', repoId, command),
    stop: (repoId: string) => ipcRenderer.invoke('process:stop', repoId),
    restart: (repoId: string) =>
      ipcRenderer.invoke('process:restart', repoId),
    getAll: () => ipcRenderer.invoke('process:get-all'),
    resize: (repoId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('process:resize', repoId, cols, rows),
  },

  ports: {
    scan: () => ipcRenderer.invoke('port:scan'),
    startMonitoring: () => ipcRenderer.invoke('port:start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('port:stop-monitoring'),
    killByPort: (port: number) =>
      ipcRenderer.invoke('port:kill-by-port', port),
  },

  shell: {
    openInVSCode: (dirPath: string) =>
      ipcRenderer.invoke('shell:open-in-vscode', dirPath),
    openInTerminal: (dirPath: string) =>
      ipcRenderer.invoke('shell:open-in-terminal', dirPath),
    openUrl: (url: string) =>
      ipcRenderer.invoke('shell:open-url', url),
  },

  logs: {
    get: (repoId: string) => ipcRenderer.invoke('logs:get', repoId),
    clear: (repoId: string) => ipcRenderer.invoke('logs:clear', repoId),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (config: any) => ipcRenderer.invoke('config:update', config),
    setCommandOverride: (repoId: string, command: string) =>
      ipcRenderer.invoke('config:set-command-override', repoId, command),
    removeCommandOverride: (repoId: string) =>
      ipcRenderer.invoke('config:remove-command-override', repoId),
  },

  on: {
    repositoriesChanged: (callback: (repos: any[]) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('repo:changed', handler)
      return () => ipcRenderer.removeListener('repo:changed', handler)
    },
    processOutput: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('process:output', handler)
      return () => ipcRenderer.removeListener('process:output', handler)
    },
    processStatusChanged: (callback: (info: any) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('process:status-changed', handler)
      return () =>
        ipcRenderer.removeListener('process:status-changed', handler)
    },
    portsChanged: (callback: (ports: any[]) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('port:changed', handler)
      return () => ipcRenderer.removeListener('port:changed', handler)
    },
  },
}

contextBridge.exposeInMainWorld('electron', electronAPI)

export type ElectronAPI = typeof electronAPI
