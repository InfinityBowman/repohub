import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  repositories: {
    scan: () => ipcRenderer.invoke('repo:scan'),
    rescan: () => ipcRenderer.invoke('repo:rescan'),
    getById: (id: string) => ipcRenderer.invoke('repo:get-by-id', id),
    readFile: (repoId: string, relativePath: string) =>
      ipcRenderer.invoke('repo:read-file', repoId, relativePath),
  },

  git: {
    listBranches: (repoId: string) => ipcRenderer.invoke('git:list-branches', repoId),
    deleteBranches: (repoId: string, branches: string[]) =>
      ipcRenderer.invoke('git:delete-branches', repoId, branches),
  },

  processes: {
    start: (repoId: string, command?: string) =>
      ipcRenderer.invoke('process:start', repoId, command),
    stop: (repoId: string) => ipcRenderer.invoke('process:stop', repoId),
    restart: (repoId: string) => ipcRenderer.invoke('process:restart', repoId),
    getAll: () => ipcRenderer.invoke('process:get-all'),
    resize: (repoId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('process:resize', repoId, cols, rows),
    startPackage: (repoId: string, packageName: string, scriptName: string) =>
      ipcRenderer.invoke('process:start-package', repoId, packageName, scriptName),
    stopPackage: (repoId: string, packageName: string) =>
      ipcRenderer.invoke('process:stop-package', repoId, packageName),
    restartPackage: (repoId: string, packageName: string, scriptName: string) =>
      ipcRenderer.invoke('process:restart-package', repoId, packageName, scriptName),
    resizePackage: (repoId: string, packageName: string, cols: number, rows: number) =>
      ipcRenderer.invoke('process:resize-package', repoId, packageName, cols, rows),
    write: (repoId: string, data: string) => ipcRenderer.invoke('process:write', repoId, data),
    openShell: (repoId: string) => ipcRenderer.invoke('process:open-shell', repoId),
  },

  ports: {
    scan: () => ipcRenderer.invoke('port:scan'),
    startMonitoring: () => ipcRenderer.invoke('port:start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('port:stop-monitoring'),
    killByPort: (port: number) => ipcRenderer.invoke('port:kill-by-port', port),
  },

  shell: {
    openInVSCode: (dirPath: string) => ipcRenderer.invoke('shell:open-in-vscode', dirPath),
    openInTerminal: (dirPath: string) => ipcRenderer.invoke('shell:open-in-terminal', dirPath),
    openUrl: (url: string) => ipcRenderer.invoke('shell:open-url', url),
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

  health: {
    check: (repoId: string) => ipcRenderer.invoke('health:check', repoId),
    checkAll: (repoIds: string[]) => ipcRenderer.invoke('health:check-all', repoIds),
    get: (repoId: string) => ipcRenderer.invoke('health:get', repoId),
    clear: (repoId: string) => ipcRenderer.invoke('health:clear', repoId),
  },

  github: {
    checkAvailability: () => ipcRenderer.invoke('github:check-availability'),
    getPRForBranch: (repoId: string) => ipcRenderer.invoke('github:get-pr-for-branch', repoId),
    getAllUserPRs: () => ipcRenderer.invoke('github:get-all-user-prs'),
    refresh: () => ipcRenderer.invoke('github:refresh'),
    createPR: (repoId: string) => ipcRenderer.invoke('github:create-pr', repoId),
    searchTrending: (language?: string, period?: string) =>
      ipcRenderer.invoke('github:trending', language, period),
    getTrendingReadme: (fullName: string) => ipcRenderer.invoke('github:trending-readme', fullName),
  },

  scaffold: {
    getTemplates: () => ipcRenderer.invoke('scaffold:get-templates'),
    createFromTemplate: (templateName: string, projectName: string) =>
      ipcRenderer.invoke('scaffold:create-from-template', templateName, projectName),
    getRecipes: () => ipcRenderer.invoke('scaffold:get-recipes'),
    addRecipe: (recipe: any) => ipcRenderer.invoke('scaffold:add-recipe', recipe),
    removeRecipe: (id: string) => ipcRenderer.invoke('scaffold:remove-recipe', id),
    run: (recipeId: string, projectName: string) =>
      ipcRenderer.invoke('scaffold:run', recipeId, projectName),
    write: (data: string) => ipcRenderer.invoke('scaffold:write', data),
    resize: (cols: number, rows: number) => ipcRenderer.invoke('scaffold:resize', cols, rows),
    cancel: () => ipcRenderer.invoke('scaffold:cancel'),
  },

  packages: {
    search: (query: string, limit?: number) => ipcRenderer.invoke('packages:search', query, limit),
    getDetails: (packageName: string) => ipcRenderer.invoke('packages:get-details', packageName),
  },

  packageClone: {
    clone: (packageName: string, repoUrl: string) =>
      ipcRenderer.invoke('package-clone:clone', packageName, repoUrl),
    getStatus: (packageName: string) => ipcRenderer.invoke('package-clone:status', packageName),
    listFiles: (packageName: string, relativePath?: string) =>
      ipcRenderer.invoke('package-clone:list-files', packageName, relativePath || ''),
    readFile: (packageName: string, relativePath: string) =>
      ipcRenderer.invoke('package-clone:read-file', packageName, relativePath),
    deleteClone: (packageName: string) => ipcRenderer.invoke('package-clone:delete', packageName),
  },

  agent: {
    launch: (config: any) => ipcRenderer.invoke('agent:launch', config),
    stop: (sessionId: string) => ipcRenderer.invoke('agent:stop', sessionId),
    sendMessage: (sessionId: string, content: string) =>
      ipcRenderer.invoke('agent:send-message', { sessionId, content }),
    list: () => ipcRenderer.invoke('agent:list'),
    getMessages: (sessionId: string) => ipcRenderer.invoke('agent:get-messages', sessionId),
    listSessions: (repoPath: string) => ipcRenderer.invoke('agent:list-sessions', repoPath),
    readSession: (repoPath: string, sessionId: string) =>
      ipcRenderer.invoke('agent:read-session', { repoPath, sessionId }),
    resumeSession: (cliSessionId: string, repoPath: string, config: any) =>
      ipcRenderer.invoke('agent:resume-session', { cliSessionId, config }),
  },

  search: {
    query: (options: any) => ipcRenderer.invoke('search:query', options),
    startIndexing: (dirs?: string[]) => ipcRenderer.invoke('search:start-indexing', dirs),
    getStatus: () => ipcRenderer.invoke('search:get-status'),
    ensureModel: () => ipcRenderer.invoke('search:ensure-model'),
    reindex: () => ipcRenderer.invoke('search:reindex'),
  },

  on: {
    repositoriesChanged: (callback: (repos: any[]) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('repo:changed', handler);
      return () => ipcRenderer.removeListener('repo:changed', handler);
    },
    processOutput: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('process:output', handler);
      return () => ipcRenderer.removeListener('process:output', handler);
    },
    processStatusChanged: (callback: (info: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('process:status-changed', handler);
      return () => ipcRenderer.removeListener('process:status-changed', handler);
    },
    portsChanged: (callback: (ports: any[]) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('port:changed', handler);
      return () => ipcRenderer.removeListener('port:changed', handler);
    },
    healthChanged: (callback: (health: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('health:changed', handler);
      return () => ipcRenderer.removeListener('health:changed', handler);
    },
    githubChanged: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('github:changed', handler);
      return () => ipcRenderer.removeListener('github:changed', handler);
    },
    scaffoldOutput: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('scaffold:output', handler);
      return () => ipcRenderer.removeListener('scaffold:output', handler);
    },
    scaffoldDone: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('scaffold:done', handler);
      return () => ipcRenderer.removeListener('scaffold:done', handler);
    },
    agentLaunched: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:launched', handler);
      return () => ipcRenderer.removeListener('agent:launched', handler);
    },
    agentStatusChanged: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:status-changed', handler);
      return () => ipcRenderer.removeListener('agent:status-changed', handler);
    },
    agentOutput: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:output', handler);
      return () => ipcRenderer.removeListener('agent:output', handler);
    },
    agentResult: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:result', handler);
      return () => ipcRenderer.removeListener('agent:result', handler);
    },
    agentStream: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:stream', handler);
      return () => ipcRenderer.removeListener('agent:stream', handler);
    },
    agentStreamThinking: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:stream-thinking', handler);
      return () => ipcRenderer.removeListener('agent:stream-thinking', handler);
    },
    agentError: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('agent:error', handler);
      return () => ipcRenderer.removeListener('agent:error', handler);
    },
    searchStatusChanged: (callback: (status: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('search:status-changed', handler);
      return () => ipcRenderer.removeListener('search:status-changed', handler);
    },
    searchModelProgress: (callback: (progress: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('search:model-progress', handler);
      return () => ipcRenderer.removeListener('search:model-progress', handler);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);

export type ElectronAPI = typeof electronAPI;
