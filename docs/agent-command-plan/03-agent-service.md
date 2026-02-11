# 03 — AgentService & Session Management

## AgentService

The central service for agent lifecycle management. Runs in the main process.

```typescript
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';

class AgentService extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private wsServer: AgentWebSocketServer;
  private sessionStore: ElectronStore; // For persisted session history

  constructor(wsServer: AgentWebSocketServer, sessionStore: ElectronStore) {
    super();
    this.wsServer = wsServer;
    this.sessionStore = sessionStore;
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  async launchAgent(config: AgentLaunchConfig): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session = this.createSession(sessionId, config);
    this.sessions.set(sessionId, session);

    // Build CLI args
    const args = this.buildCLIArgs(sessionId, config);

    // Spawn Claude CLI
    const proc = spawn('claude', args, {
      cwd: config.repoPath,
      env: {
        ...process.env,
        // Inject shared context path, agent metadata
        REPOHUB_AGENT_ID: sessionId,
        REPOHUB_AGENT_ROLE: config.role.id,
        REPOHUB_REPO_NAME: config.repoName,
      },
    });

    session.process = proc;
    session.pid = proc.pid;

    // Handle process exit
    proc.on('exit', code => {
      this.handleProcessExit(sessionId, code);
    });

    // Wait for WebSocket connection (with timeout)
    await this.waitForConnection(sessionId, 15_000);

    // If task provided, send as first message
    if (config.task) {
      this.sendMessage(sessionId, config.task);
    }

    this.emit('agent:launched', { sessionId, config });
    return sessionId;
  }

  stopAgent(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Send interrupt via WebSocket first (graceful)
    if (session.cliSocket?.readyState === WebSocket.OPEN) {
      this.sendToCLI(session, {
        type: 'control_request',
        request: { subtype: 'interrupt' },
      });
    }

    // If process still running after 5s, kill it
    setTimeout(() => {
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
    }, 5_000);

    session.state = 'stopping';
    this.emit('agent:status-changed', { sessionId, state: 'stopping' });
  }

  sendMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const msg = { type: 'user_message', content };
    const ndjson = JSON.stringify(msg) + '\n';

    if (session.cliSocket?.readyState === WebSocket.OPEN) {
      session.cliSocket.send(ndjson);
    } else {
      session.pendingMessages.push(ndjson);
    }

    // Record in history
    session.messageHistory.push({
      id: crypto.randomUUID(),
      type: 'user',
      timestamp: Date.now(),
      content,
    });

    session.state = 'working';
    this.emit('agent:status-changed', { sessionId, state: 'working' });
  }

  respondPermission(sessionId: string, requestId: string, response: PermissionResponse): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const pending = session.pendingPermissions.get(requestId);
    if (!pending) return;

    // Build control_response
    const controlResponse = {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: {
          behavior: response.behavior,
          updatedInput: response.updatedInput || pending.input,
          updatedPermissions: response.updatedPermissions || [],
        },
      },
    };

    this.sendToCLI(session, controlResponse);
    session.pendingPermissions.delete(requestId);

    // Record in history
    session.messageHistory.push({
      id: crypto.randomUUID(),
      type: 'permission',
      timestamp: Date.now(),
      permissionRequest: pending,
      permissionResponse: { behavior: response.behavior },
    });
  }

  // ─── Queries ───────────────────────────────────────────────

  getAgent(sessionId: string): AgentInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return this.toAgentInfo(session);
  }

  getRunningAgents(): AgentInfo[] {
    return Array.from(this.sessions.values())
      .filter(s => s.state !== 'completed' && s.state !== 'error')
      .map(s => this.toAgentInfo(s));
  }

  getAllAgents(): AgentInfo[] {
    return Array.from(this.sessions.values()).map(s => this.toAgentInfo(s));
  }

  getMessageHistory(sessionId: string): AgentMessage[] {
    return this.sessions.get(sessionId)?.messageHistory ?? [];
  }

  getSessionHistory(): PersistedSession[] {
    return this.sessionStore.get('sessions', []);
  }

  // ─── Session Resume ────────────────────────────────────────

  async resumeSession(sessionId: string): Promise<string> {
    // Look up persisted session
    const persisted = this.getPersistedSession(sessionId);
    if (!persisted?.cliSessionId) throw new Error('No CLI session ID for resume');

    // Launch with --resume flag
    const newSessionId = await this.launchAgent({
      ...persisted.config,
      resumeSessionId: persisted.cliSessionId,
    });

    // Pre-populate message history from persisted session
    const newSession = this.sessions.get(newSessionId)!;
    newSession.messageHistory = [...persisted.messageHistory];

    return newSessionId;
  }

  // ─── WebSocket Handling ────────────────────────────────────

  handleCLIConnection(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close(4004, 'Unknown session');
      return;
    }

    session.cliSocket = ws;
    session.state = 'connected';

    ws.on('message', raw => {
      const text = raw.toString();
      const messages = this.parseNDJSON(text);
      for (const msg of messages) {
        this.routeCLIMessage(sessionId, msg);
      }
    });

    ws.on('close', () => {
      session.cliSocket = null;
      if (session.state !== 'completed' && session.state !== 'stopping') {
        session.state = 'disconnected';
        this.emit('agent:status-changed', { sessionId, state: 'disconnected' });
      }
    });

    // Flush pending messages
    for (const ndjson of session.pendingMessages) {
      ws.send(ndjson);
    }
    session.pendingMessages = [];

    this.emit('agent:status-changed', { sessionId, state: 'connected' });
  }

  private routeCLIMessage(sessionId: string, msg: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (msg.type) {
      case 'system/init':
        session.cliSessionId = msg.session_id;
        session.model = msg.model;
        session.tools = msg.tools;
        session.state = 'initialized';
        this.emit('agent:initialized', { sessionId, model: msg.model, tools: msg.tools });
        break;

      case 'assistant':
        session.messageHistory.push({
          id: crypto.randomUUID(),
          type: 'assistant',
          timestamp: Date.now(),
          contentBlocks: msg.message.content,
          usage: msg.message.usage,
        });
        session.state = 'working';
        this.emit('agent:output', { sessionId, message: msg.message });
        break;

      case 'control_request':
        if (msg.request.subtype === 'can_use_tool') {
          const permReq: PermissionRequest = {
            requestId: msg.request_id,
            toolName: msg.request.tool_name,
            input: msg.request.input,
            toolUseId: msg.request.tool_use_id,
            description: msg.request.description,
            timestamp: Date.now(),
          };
          session.pendingPermissions.set(msg.request_id, permReq);
          session.state = 'waiting_for_permission';

          // Auto-approve for autonomous mode or read-only tools
          if (this.shouldAutoApprove(session, permReq)) {
            this.respondPermission(sessionId, msg.request_id, {
              behavior: 'allow',
              updatedInput: permReq.input,
            });
          } else {
            this.emit('agent:permission-request', { sessionId, request: permReq });
          }
        }
        break;

      case 'result':
        session.totalCostUsd = msg.total_cost_usd;
        session.totalTokens = {
          input: msg.usage.input_tokens,
          output: msg.usage.output_tokens,
          cache: msg.usage.cache_read_input_tokens,
        };
        session.state = msg.is_error ? 'error' : 'idle';
        this.emit('agent:result', { sessionId, result: msg });
        break;

      case 'stream_event':
        this.emit('agent:stream', { sessionId, event: msg });
        break;

      case 'tool_progress':
        this.emit('agent:heartbeat', { sessionId });
        break;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private buildCLIArgs(sessionId: string, config: AgentLaunchConfig): string[] {
    const args = [
      '--sdk-url',
      `ws://127.0.0.1:${this.wsServer.getPort()}/ws/cli/${sessionId}`,
      '--print',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      '--verbose',
    ];

    // Role system prompt
    const systemPrompt = this.buildSystemPrompt(config);
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Permission mode based on role + mode
    const permMode = this.getPermissionMode(config);
    if (permMode) {
      args.push('--permission-mode', permMode);
    }

    // Resume
    if (config.resumeSessionId) {
      args.push('--resume', config.resumeSessionId);
    }

    // Empty initial prompt (we send via WebSocket)
    args.push('-p', '');

    return args;
  }

  private buildSystemPrompt(config: AgentLaunchConfig): string {
    const parts: string[] = [];

    // Conductor profile (global user preferences)
    if (config.conductorProfile) {
      parts.push(config.conductorProfile);
    }

    // Role-specific prompt
    parts.push(config.role.systemPromptPrefix);

    // Repo context
    parts.push(`Working in repository: ${config.repoName} (${config.repoPath})`);

    return parts.join('\n\n');
  }

  private shouldAutoApprove(session: AgentSession, request: PermissionRequest): boolean {
    // Autonomous mode: always approve
    if (session.config.mode === 'autonomous') return true;

    // Read-only roles: approve read tools, deny write tools
    if (session.config.role.permissions === 'read-only') {
      const readOnlyTools = ['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch'];
      return readOnlyTools.includes(request.toolName);
    }

    return false;
  }

  private sendToCLI(session: AgentSession, msg: object): void {
    if (session.cliSocket?.readyState === WebSocket.OPEN) {
      session.cliSocket.send(JSON.stringify(msg) + '\n');
    }
  }
}
```

## Role System

### Built-in Roles

```typescript
const BUILT_IN_ROLES: AgentRole[] = [
  {
    id: 'coder',
    name: 'Coder',
    icon: 'Code',
    description: 'Writes features, fixes bugs, implements things',
    systemPromptPrefix:
      "You are a coding agent. Write clean, idiomatic code. Follow existing patterns in the codebase. Make targeted changes — don't refactor unrelated code.",
    permissions: 'full',
    color: '#82aaff',
    defaultMode: 'supervised',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    icon: 'Eye',
    description: 'Reviews uncommitted changes, finds issues, suggests fixes',
    systemPromptPrefix:
      'You are a code reviewer. Examine the current uncommitted changes (run git diff). Look for bugs, security issues, race conditions, missing error handling, and style problems. Be specific about file and line. Suggest concrete fixes. Do NOT modify any files.',
    permissions: 'read-only',
    color: '#c3e88d',
    defaultMode: 'autonomous',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    icon: 'Search',
    description: 'Explores code, reads docs, investigates approaches',
    systemPromptPrefix:
      'You are a research agent. Read code, trace execution paths, map dependencies, and report findings. Answer questions about the codebase architecture. Do NOT modify any files.',
    permissions: 'read-only',
    color: '#ffcb6b',
    defaultMode: 'autonomous',
  },
  {
    id: 'architect',
    name: 'Architect',
    icon: 'FlaskConical',
    description: 'Discusses design, helps plan before coding',
    systemPromptPrefix:
      'You are an architecture advisor. Analyze the codebase structure and discuss design decisions. Propose patterns, data flows, and component hierarchies. Think about scalability and maintainability. Do NOT modify files — only analyze and recommend.',
    permissions: 'read-only',
    color: '#c792ea',
    defaultMode: 'autonomous',
  },
  {
    id: 'tester',
    name: 'Tester',
    icon: 'FlaskConical',
    description: 'Writes and runs tests, checks coverage',
    systemPromptPrefix:
      'You are a testing agent. Write comprehensive tests for the codebase. Run existing test suites and report results. Focus on edge cases, error paths, and integration tests.',
    permissions: 'full',
    color: '#f78c6c',
    defaultMode: 'supervised',
  },
  {
    id: 'security',
    name: 'Security',
    icon: 'Shield',
    description: 'Audits code for vulnerabilities, checks deps',
    systemPromptPrefix:
      'You are a security auditor. Scan the codebase for vulnerabilities: injection, XSS, auth issues, exposed secrets, insecure dependencies, misconfigured permissions. Report findings with severity and recommended fixes. Do NOT modify files.',
    permissions: 'read-only',
    color: '#f07178',
    defaultMode: 'autonomous',
  },
];
```

### Custom Roles

Users can add custom roles in Settings:

```typescript
interface AgentRole {
  id: string; // User-defined or built-in
  name: string;
  icon: string; // Lucide icon name
  description: string; // One-line description
  systemPromptPrefix: string;
  permissions: 'full' | 'read-write' | 'read-only';
  color: string; // Hex color for badges
  defaultMode: 'supervised' | 'autonomous';
  isBuiltIn?: boolean; // Built-in roles can't be deleted
}
```

### Role → Permission Mode Mapping

```
supervised + full permissions  → "default" (ask for everything)
supervised + read-only         → "plan" (read only)
autonomous + full permissions  → "bypassPermissions" (auto-approve all)
autonomous + read-only         → "plan" (still read only — safety net)
```

## Shared Context (Scratchpad)

A simple key-value store visible to all agents in a session group:

```typescript
interface SharedContextEntry {
  key: string;
  value: string;
  source: string; // "my-api / Coder" or "You"
  timestamp: number;
}

class SharedContextStore {
  private entries: SharedContextEntry[] = [];

  add(key: string, value: string, source: string): void;
  remove(key: string): void;
  getAll(): SharedContextEntry[];
  toPromptString(): string {
    // Format for injection into agent system prompts
    return this.entries.map(e => `${e.key}: ${e.value} (from ${e.source})`).join('\n');
  }
}
```

Shared context is injected into each agent's system prompt. When a new entry is added, we can optionally notify running agents by sending a user message: "Shared context updated: [key]: [value]".

## Session Persistence

### What Gets Persisted

When a session completes or is stopped:

```typescript
private persistSession(session: AgentSession): void {
  const persisted: PersistedSession = {
    id: session.id,
    cliSessionId: session.cliSessionId!,
    config: session.config,
    messageHistory: session.messageHistory,
    stats: {
      tokens: session.totalTokens,
      cost: session.totalCostUsd,
      duration: Date.now() - session.startedAt.getTime(),
    },
    completedAt: new Date().toISOString(),
    status: session.state === 'error' ? 'error' : 'completed',
  }

  const sessions = this.sessionStore.get('sessions', [])
  sessions.push(persisted)

  // Keep last 100 sessions
  if (sessions.length > 100) {
    sessions.splice(0, sessions.length - 100)
  }

  this.sessionStore.set('sessions', sessions)
}
```

### Session Resume

```typescript
// User clicks "Resume" on a completed session
const newSessionId = await agentService.resumeSession(oldSessionId);

// Internally:
// 1. Look up persisted session
// 2. Get cliSessionId from persistence
// 3. Spawn claude --resume {cliSessionId} --sdk-url ws://...
// 4. Claude restores conversation history
// 5. Pre-populate our message history for UI replay
```

## Agent State Machine

```
                    ┌────────────┐
         spawn()    │  STARTING  │
        ┌──────────►│            │
        │           └─────┬──────┘
        │                 │ WebSocket connects
        │           ┌─────▼──────┐
        │           │  CONNECTED │
        │           └─────┬──────┘
        │                 │ system/init received
        │           ┌─────▼──────────┐
        │           │  INITIALIZED   │
        │           └─────┬──────────┘
        │                 │ user_message sent
        │           ┌─────▼──────┐
        │    ┌─────►│  WORKING   │◄────────────┐
        │    │      └─────┬──────┘             │
        │    │            │                     │
        │    │      ┌─────▼──────────────┐     │
        │    │      │ WAITING_PERMISSION │     │ response sent
        │    │      └─────┬──────────────┘     │
        │    │            │ user responds       │
        │    │            └─────────────────────┘
        │    │
        │    │      ┌─────────────┐
        │    │      │    IDLE     │ ← result received (turn done)
        │    │      │ (ready for  │
        │    └──────│  next msg)  │
        │           └─────┬──────┘
        │                 │ session ends / user closes
        │           ┌─────▼──────┐
        │           │ COMPLETED  │ → persist session
        │           └────────────┘
        │
        │           ┌────────────┐
        │           │  STOPPING  │ ← user clicks stop
        │           └─────┬──────┘
        │                 │ process exits
        │           ┌─────▼──────┐
        └───────────│   ERROR    │ ← crash / timeout / disconnect
                    └────────────┘
```
