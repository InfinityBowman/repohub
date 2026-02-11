# 05 — IPC Channel Specification

## Overview

All IPC channels follow the existing RepoHub pattern:
- **Invoke** channels: Renderer calls main, gets a response (request/response)
- **Send** channels: Main pushes events to renderer (one-way)
- **Handler** registration: In `src/main/ipc/agent.handler.ts`
- **Preload** bridge: In `src/preload/index.ts` under `window.electron.agent`

## Invoke Channels (Request/Response)

### `agent:launch`

Launch a new agent session.

```typescript
// Renderer → Main
invoke('agent:launch', config: AgentLaunchConfig)

// Returns
{ sessionId: string, state: 'starting' }

// Config
interface AgentLaunchConfig {
  repoId: string
  repoPath: string
  repoName: string
  role: AgentRole
  task?: string
  mode: 'supervised' | 'autonomous'
  systemPrompt?: string        // Custom override
  conductorProfile?: string    // From settings
  resumeSessionId?: string     // For resume
  envVars?: Record<string, string>  // Additional env
}
```

### `agent:stop`

Stop a running agent.

```typescript
invoke('agent:stop', sessionId: string)
// Returns: void
```

### `agent:send-message`

Send a user message to an agent.

```typescript
invoke('agent:send-message', { sessionId: string, content: string })
// Returns: void
```

### `agent:respond-permission`

Respond to a tool permission request.

```typescript
invoke('agent:respond-permission', {
  sessionId: string,
  requestId: string,
  response: {
    behavior: 'allow' | 'deny',
    updatedInput?: Record<string, unknown>,
    updatedPermissions?: PermissionUpdate[],
    message?: string
  }
})
// Returns: void
```

### `agent:list`

Get all running and recent agents.

```typescript
invoke('agent:list')
// Returns: AgentInfo[]
```

### `agent:get-messages`

Get message history for an agent.

```typescript
invoke('agent:get-messages', sessionId: string)
// Returns: AgentMessage[]
```

### `agent:get-history`

Get persisted session history (completed sessions).

```typescript
invoke('agent:get-history')
// Returns: PersistedSession[]
```

### `agent:resume`

Resume a completed session.

```typescript
invoke('agent:resume', sessionId: string)
// Returns: { sessionId: string }  // New session ID
```

### `agent:get-shared-context`

Get shared context entries.

```typescript
invoke('agent:get-shared-context')
// Returns: SharedContextEntry[]
```

### `agent:set-shared-context`

Add or update a shared context entry.

```typescript
invoke('agent:set-shared-context', {
  key: string,
  value: string,
  source: string
})
// Returns: void
```

### `agent:remove-shared-context`

Remove a shared context entry.

```typescript
invoke('agent:remove-shared-context', key: string)
// Returns: void
```

## Phase 2 Invoke Channels

### `agent:get-diff`

Get file changes for an agent's working directory.

```typescript
invoke('agent:get-diff', sessionId: string)
// Returns: FileDiff[]
```

### `agent:interrupt`

Send interrupt signal (Ctrl+C equivalent).

```typescript
invoke('agent:interrupt', sessionId: string)
// Returns: void
```

### `agent:set-model`

Change the model mid-session.

```typescript
invoke('agent:set-model', { sessionId: string, model: string })
// Returns: void
```

## Event Channels (Main → Renderer)

### `agent:launched`

Emitted when an agent is fully launched.

```typescript
send('agent:launched', {
  sessionId: string,
  agent: AgentInfo
})
```

### `agent:status-changed`

Emitted when agent state changes.

```typescript
send('agent:status-changed', {
  sessionId: string,
  state: AgentState,
  previousState: AgentState
})
```

### `agent:output`

Emitted when the agent sends a response.

```typescript
send('agent:output', {
  sessionId: string,
  message: {
    id: string,
    content: ContentBlock[],
    usage: { input_tokens: number, output_tokens: number }
  }
})
```

### `agent:permission-request`

Emitted when agent needs tool approval.

```typescript
send('agent:permission-request', {
  sessionId: string,
  request: {
    requestId: string,
    toolName: string,
    input: Record<string, unknown>,
    description?: string,
    timestamp: number
  }
})
```

### `agent:result`

Emitted when an agent turn completes.

```typescript
send('agent:result', {
  sessionId: string,
  result: {
    is_error: boolean,
    total_cost_usd: number,
    usage: TokenUsage,
    duration_ms: number,
    num_turns: number
  }
})
```

### `agent:stream`

Emitted for real-time token streaming.

```typescript
send('agent:stream', {
  sessionId: string,
  event: {
    type: 'content_block_delta',
    data: { type: 'text_delta' | 'thinking_delta', text?: string, thinking?: string }
  }
})
```

### `agent:completed`

Emitted when an agent session fully ends.

```typescript
send('agent:completed', {
  sessionId: string,
  stats: {
    tokens: TokenUsage,
    cost: number,
    duration: number,
    filesChanged: number
  }
})
```

### `agent:error`

Emitted on agent error (crash, timeout, etc.).

```typescript
send('agent:error', {
  sessionId: string,
  error: string,
  recoverable: boolean  // true if resume is possible
})
```

### `agent:shared-context-updated`

Emitted when shared context changes.

```typescript
send('agent:shared-context-updated', {
  entries: SharedContextEntry[]
})
```

## Preload Bridge

```typescript
// In src/preload/index.ts
const api = {
  // ... existing API ...

  agent: {
    launch: (config: AgentLaunchConfig) => ipcRenderer.invoke('agent:launch', config),
    stop: (id: string) => ipcRenderer.invoke('agent:stop', id),
    sendMessage: (id: string, content: string) =>
      ipcRenderer.invoke('agent:send-message', { sessionId: id, content }),
    respondPermission: (agentId: string, requestId: string, response: PermissionResponse) =>
      ipcRenderer.invoke('agent:respond-permission', { sessionId: agentId, requestId, response }),
    list: () => ipcRenderer.invoke('agent:list'),
    getMessages: (id: string) => ipcRenderer.invoke('agent:get-messages', id),
    getHistory: () => ipcRenderer.invoke('agent:get-history'),
    resume: (id: string) => ipcRenderer.invoke('agent:resume', id),
    getSharedContext: () => ipcRenderer.invoke('agent:get-shared-context'),
    setSharedContext: (entry: { key: string; value: string; source: string }) =>
      ipcRenderer.invoke('agent:set-shared-context', entry),
    removeSharedContext: (key: string) =>
      ipcRenderer.invoke('agent:remove-shared-context', key),

    // Phase 2
    getDiff: (id: string) => ipcRenderer.invoke('agent:get-diff', id),
    interrupt: (id: string) => ipcRenderer.invoke('agent:interrupt', id),
    setModel: (id: string, model: string) =>
      ipcRenderer.invoke('agent:set-model', { sessionId: id, model }),
  },
}
```

## IPC Handler Registration

```typescript
// src/main/ipc/agent.handler.ts

export function registerAgentHandlers(
  agentService: AgentService,
  mainWindow: BrowserWindow
): void {
  // Invoke handlers
  ipcMain.handle('agent:launch', async (_e, config) => {
    const sessionId = await agentService.launchAgent(config)
    return { sessionId, state: 'starting' }
  })

  ipcMain.handle('agent:stop', async (_e, sessionId) => {
    agentService.stopAgent(sessionId)
  })

  ipcMain.handle('agent:send-message', async (_e, { sessionId, content }) => {
    agentService.sendMessage(sessionId, content)
  })

  ipcMain.handle('agent:respond-permission', async (_e, { sessionId, requestId, response }) => {
    agentService.respondPermission(sessionId, requestId, response)
  })

  ipcMain.handle('agent:list', async () => {
    return agentService.getAllAgents()
  })

  ipcMain.handle('agent:get-messages', async (_e, sessionId) => {
    return agentService.getMessageHistory(sessionId)
  })

  ipcMain.handle('agent:get-history', async () => {
    return agentService.getSessionHistory()
  })

  ipcMain.handle('agent:resume', async (_e, sessionId) => {
    const newId = await agentService.resumeSession(sessionId)
    return { sessionId: newId }
  })

  // ... shared context handlers ...

  // Event forwarding (service events → renderer)
  const forwardEvents = [
    'agent:launched',
    'agent:status-changed',
    'agent:output',
    'agent:permission-request',
    'agent:result',
    'agent:stream',
    'agent:completed',
    'agent:error',
    'agent:shared-context-updated',
  ]

  for (const event of forwardEvents) {
    agentService.on(event, (data) => {
      mainWindow.webContents.send(event, data)
    })
  }
}
```
