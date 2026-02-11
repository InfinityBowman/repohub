# 04 — Renderer Components & State Management

## Zustand Store

### agentStore

```typescript
// src/renderer/src/store/agentStore.ts
import { create } from 'zustand';

interface AgentState {
  // Agent data
  agents: Map<string, AgentInfo>;
  activeAgentId: string | null;
  viewMode: 'focused' | 'grid';

  // Message histories (per agent)
  messages: Map<string, AgentMessage[]>;

  // Pending permission requests
  pendingPermissions: Map<string, PermissionRequest[]>;

  // Streaming state (accumulating text per agent)
  streaming: Map<string, string>;

  // Session history (completed sessions)
  sessionHistory: PersistedSession[];

  // Shared context
  sharedContext: SharedContextEntry[];

  // Actions
  setAgents: (agents: AgentInfo[]) => void;
  addAgent: (agent: AgentInfo) => void;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void;
  removeAgent: (id: string) => void;

  setActiveAgent: (id: string | null) => void;
  setViewMode: (mode: 'focused' | 'grid') => void;

  appendMessage: (agentId: string, message: AgentMessage) => void;
  setMessages: (agentId: string, messages: AgentMessage[]) => void;

  addPermissionRequest: (agentId: string, request: PermissionRequest) => void;
  removePermissionRequest: (agentId: string, requestId: string) => void;

  appendStreamChunk: (agentId: string, chunk: string) => void;
  clearStream: (agentId: string) => void;

  setSessionHistory: (sessions: PersistedSession[]) => void;
  setSharedContext: (entries: SharedContextEntry[]) => void;
}
```

### AgentInfo Type

```typescript
interface AgentInfo {
  id: string;
  config: AgentLaunchConfig;
  state: AgentState; // 'starting' | 'connected' | 'working' | 'idle' | etc
  model?: string;
  pid?: number;
  cliSessionId?: string;

  // Stats
  tokensUsed: number;
  costUsd: number;
  startedAt: number;
  completedAt?: number;
  filesChanged: number;

  // Context (Phase 2+)
  contextUsed?: number;
  contextMax?: number;
}
```

## Hook: useAgents

```typescript
// src/renderer/src/hooks/useAgents.ts

// Module-level listener count (StrictMode pattern from useProcesses.ts)
let listenerCount = 0;

export function useAgents() {
  const store = useAgentStore();

  useEffect(() => {
    listenerCount++;
    if (listenerCount > 1)
      return () => {
        listenerCount--;
      };

    // Register IPC listeners
    const listeners = {
      'agent:launched': (_e, data) => {
        store.addAgent(data.agent);
      },
      'agent:status-changed': (_e, data) => {
        store.updateAgent(data.sessionId, { state: data.state });
      },
      'agent:output': (_e, data) => {
        // Parse assistant message into AgentMessages
        const messages = parseAssistantMessage(data.message);
        for (const msg of messages) {
          store.appendMessage(data.sessionId, msg);
        }
      },
      'agent:permission-request': (_e, data) => {
        store.addPermissionRequest(data.sessionId, data.request);
      },
      'agent:result': (_e, data) => {
        store.updateAgent(data.sessionId, {
          tokensUsed: data.result.usage.output_tokens + data.result.usage.input_tokens,
          costUsd: data.result.total_cost_usd,
          state: data.result.is_error ? 'error' : 'idle',
        });
      },
      'agent:stream': (_e, data) => {
        if (data.event.event === 'content_block_delta') {
          const text = data.event.data.text || data.event.data.thinking || '';
          store.appendStreamChunk(data.sessionId, text);
        }
      },
    };

    for (const [channel, handler] of Object.entries(listeners)) {
      window.electron.ipcRenderer.on(channel, handler);
    }

    // Initial load
    window.electron.agent.list().then(agents => store.setAgents(agents));
    window.electron.agent.getHistory().then(h => store.setSessionHistory(h));
    window.electron.agent.getSharedContext().then(c => store.setSharedContext(c));

    return () => {
      listenerCount--;
      for (const channel of Object.keys(listeners)) {
        window.electron.ipcRenderer.removeAllListeners(channel);
      }
    };
  }, []);

  return {
    agents: store.agents,
    activeAgentId: store.activeAgentId,
    viewMode: store.viewMode,
    messages: store.messages,
    pendingPermissions: store.pendingPermissions,
    streaming: store.streaming,
    sessionHistory: store.sessionHistory,
    sharedContext: store.sharedContext,

    // Actions
    launch: (config: AgentLaunchConfig) => window.electron.agent.launch(config),
    stop: (id: string) => window.electron.agent.stop(id),
    sendMessage: (id: string, content: string) => window.electron.agent.sendMessage(id, content),
    respondPermission: (agentId: string, requestId: string, response: PermissionResponse) =>
      window.electron.agent.respondPermission(agentId, requestId, response),
    resume: (sessionId: string) => window.electron.agent.resume(sessionId),

    setActiveAgent: store.setActiveAgent,
    setViewMode: store.setViewMode,
  };
}
```

## Component Hierarchy

```
AgentCommandCenter (view)
├── AgentHeader
│   ├── StatusCounts (working/waiting/thinking)
│   ├── ViewModeToggle (focused/grid)
│   ├── SharedContextPopover
│   ├── CostDisplay (aggregate)
│   └── NewAgentButton
│
├── FocusedView
│   ├── TabStrip
│   │   ├── AgentTab (one per agent)
│   │   │   ├── StatusDot
│   │   │   ├── RepoName
│   │   │   ├── RoleIcon (with tooltip)
│   │   │   ├── MicroBudgetBar (Phase 2)
│   │   │   └── CloseButton
│   │   └── NewTabButton (+)
│   │
│   ├── InfoBar
│   │   ├── TaskDescription (clickable → AgentInfoPopover)
│   │   ├── ElapsedTime
│   │   ├── TokenCount
│   │   ├── FilesChanged
│   │   ├── ContextBudgetBar (Phase 2)
│   │   ├── PanelToggle (Terminal / Changes)
│   │   ├── RestartButton
│   │   └── StopButton
│   │
│   ├── AgentTerminal (edge-to-edge)
│   │   ├── MessageList
│   │   │   ├── UserMessage (purple >)
│   │   │   ├── AgentMessage (blue ◆)
│   │   │   ├── ToolUseMessage (yellow ⟫, clickable → ToolDetailPopover)
│   │   │   ├── PermissionRequestInline (approve/deny buttons)
│   │   │   └── StreamingCursor (▌)
│   │   └── MessageInput
│   │
│   ├── ChangesPanel (when toggled, Phase 2)
│   │   ├── DiffSummaryBar
│   │   ├── FileDiffView (per file)
│   │   └── AcceptAll / RevertAll / CreatePR
│   │
│   └── ContextPanel (when toggled, Phase 2+)
│       ├── BlockList
│       │   └── BlockCard (per context block)
│       ├── CompactionBanner
│       └── TransferBar
│
├── GridView
│   ├── AgentTile (one per active agent)
│   │   ├── TileHeader (status + repo + role)
│   │   ├── TaskDescription
│   │   ├── CompactTerminal (last 4 messages)
│   │   └── TileFooter (time + status)
│   │
│   ├── NewAgentTile (dashed border, + icon)
│   │
│   └── CompletedSection
│       └── CompletedRow (per completed agent)
│
├── AgentLaunchPanel (inline, replaces content area)
│   ├── RepoPicker (searchable list)
│   ├── RolePicker (card grid)
│   ├── TaskInput (multi-line)
│   ├── ModeToggle (supervised/autonomous)
│   ├── AdvancedOptions (collapsed)
│   │   ├── CustomSystemPrompt
│   │   ├── EnvironmentVars
│   │   └── MaxTokenBudget
│   └── LaunchButton
│
└── EmptyState (when no agents)
    ├── BotIcon
    ├── Description
    └── LaunchButton
```

## Key Component Implementations

### AgentTerminal

The terminal component renders structured messages, not raw terminal output. Each message type has distinct styling:

```typescript
function AgentTerminal({ agentId }: { agentId: string }) {
  const messages = useAgentStore(s => s.messages.get(agentId) ?? [])
  const streaming = useAgentStore(s => s.streaming.get(agentId) ?? '')
  const permissions = useAgentStore(s => s.pendingPermissions.get(agentId) ?? [])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, streaming])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
      {messages.map(msg => <MessageRenderer key={msg.id} message={msg} />)}

      {/* Streaming text (accumulates until next assistant message) */}
      {streaming && (
        <div className="flex gap-2">
          <span className="text-[#82aaff] shrink-0">◆</span>
          <span className="text-[#a6accd] whitespace-pre-wrap">{streaming}</span>
        </div>
      )}

      {/* Pending permission requests (inline) */}
      {permissions.map(req => (
        <PermissionRequestInline key={req.requestId} agentId={agentId} request={req} />
      ))}

      {/* Cursor */}
      <div className="flex items-center gap-1 text-[#7982b4]">
        <span className="animate-pulse">▌</span>
      </div>
    </div>
  )
}
```

### PermissionRequestInline

Shows an inline approval UI when the agent requests tool use in supervised mode:

```typescript
function PermissionRequestInline({ agentId, request }: {
  agentId: string; request: PermissionRequest
}) {
  const { respondPermission } = useAgents()

  return (
    <div className="my-2 rounded-md border border-amber-800/40 bg-amber-900/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-medium text-amber-400">
          Permission Request: {request.toolName}
        </span>
      </div>

      {/* Show tool input */}
      <div className="text-[11px] font-mono text-[#a6accd] bg-[#1a1c2e] rounded p-2 mb-2">
        {formatToolInput(request.toolName, request.input)}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="xs"
          onClick={() => respondPermission(agentId, request.requestId, {
            behavior: 'allow',
            updatedInput: request.input,
          })}
          className="bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-800/40"
        >
          Allow
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => respondPermission(agentId, request.requestId, {
            behavior: 'deny',
            message: 'Denied by user',
          })}
          className="border-red-800/40 text-red-400 hover:bg-red-900/20"
        >
          Deny
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {request.description}
        </span>
      </div>
    </div>
  )
}
```

### AgentLaunchPanel

The inline form for configuring a new agent. Appears in-place (no modal):

```typescript
function AgentLaunchPanel({ onLaunch, onCancel }: {
  onLaunch: (config: AgentLaunchConfig) => void
  onCancel: () => void
}) {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<AgentRole>(BUILT_IN_ROLES[0])
  const [task, setTask] = useState('')
  const [mode, setMode] = useState<'supervised' | 'autonomous'>('supervised')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const repos = useRepositoryStore(s => s.repositories)

  return (
    <div className="p-6 space-y-6">
      {/* Repository Picker */}
      <section>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Repository
        </label>
        <RepoPicker repos={repos} selected={selectedRepo} onSelect={setSelectedRepo} />
      </section>

      {/* Role Picker */}
      <section>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Role
        </label>
        <RolePicker roles={BUILT_IN_ROLES} selected={selectedRole} onSelect={setSelectedRole} />
      </section>

      {/* Task Input */}
      <section>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Task
        </label>
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="What should this agent do?"
          className="w-full min-h-[80px] bg-[#1a1c2e] border border-[#4e5579]/50 rounded-md p-3 text-sm font-mono"
        />
      </section>

      {/* Mode Toggle */}
      <div className="flex items-center gap-4">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Launch Button */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={!selectedRepo}
          onClick={() => onLaunch({ repoId: selectedRepo!, role: selectedRole, task, mode })}
        >
          Launch Agent
        </Button>
      </div>
    </div>
  )
}
```

## Routing

New route added to the router:

```typescript
// In App.tsx
{ path: '/agents', element: <AgentCommandCenter /> }
```

Sidebar gets a new "Agents" entry with a status indicator (shows count of running agents).

## Cmd+K Integration

Add agent commands to the existing command palette:

```typescript
// Commands added to Cmd+K
{
  id: 'agent-new',
  label: 'New Agent',
  keywords: ['agent', 'launch', 'start'],
  icon: Bot,
  action: () => navigate('/agents', { state: { showLaunchPanel: true } }),
},
{
  id: 'agents-view',
  label: 'View Agents',
  keywords: ['agents', 'command center'],
  icon: LayoutGrid,
  action: () => navigate('/agents'),
},
// Dynamic commands for running agents
...runningAgents.map(agent => ({
  id: `agent-focus-${agent.id}`,
  label: `Focus: ${agent.config.repoName} / ${agent.config.role.name}`,
  keywords: ['agent', agent.config.repoName, agent.config.role.name],
  action: () => { navigate('/agents'); setActiveAgent(agent.id) },
})),
```
