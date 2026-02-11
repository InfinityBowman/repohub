# MCP Dev Context Server

**Category**: Showstopper
**Effort**: High
**Payoff**: RepoHub becomes the ambient brain for every AI tool you use. Claude Code, Claude Desktop, Cursor, any MCP client — they all see your repos, running processes, open ports, git state, dependency health, and code search results without you ever copy-pasting context.

## The Problem

You're chatting with Claude Code in your API repo. You ask it to debug a port conflict. It has no idea what ports are in use — it runs `lsof` and parses the output. You ask about the health of your dependencies — it runs `npm audit` from scratch. You ask which repos have dirty git state — it doesn't even know what repos you have, let alone their status.

Meanwhile, RepoHub is sitting right there with all of this information: every repo, every running process, every open port, every dependency vulnerability, every GitHub PR, every branch. It's running `lsof` every 5 seconds. It has audit caches. It knows your git state. It has a semantic code search index spanning all your projects.

But there's no bridge. RepoHub's intelligence is trapped behind its Electron window. Your AI agents start from zero every time.

The Model Context Protocol exists precisely to solve this — a standard way for applications to expose context and tools to AI models. RepoHub should be an MCP server.

## The Feature

### RepoHub as a Global MCP Server

RepoHub runs a local MCP server (stdio or HTTP) that any MCP client can connect to. When you start RepoHub, the server starts. Your AI tools automatically get access to everything RepoHub knows.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Development Machine                     │
│                                                                  │
│  ┌──────────────┐     MCP      ┌──────────────────────────────┐ │
│  │ Claude Code   │◄────────────►│                              │ │
│  └──────────────┘              │     RepoHub MCP Server        │ │
│                                │                               │ │
│  ┌──────────────┐     MCP      │  Resources:                  │ │
│  │ Claude Desktop│◄────────────►│   repos, processes, ports,   │ │
│  └──────────────┘              │   git, github, health,       │ │
│                                │   code-search, config        │ │
│  ┌──────────────┐     MCP      │                               │ │
│  │ Cursor / any  │◄────────────►│  Tools:                      │ │
│  │ MCP client    │             │   start/stop process,        │ │
│  └──────────────┘              │   search code, run health    │ │
│                                │   check, scan repos, ...     │ │
│                                └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

This isn't a plugin system or an API for third-party developers. It's RepoHub exposing its own brain to the AI tools you already use — a globally available context layer for your entire development environment.

### MCP Resources (Read Context)

Resources are the read side. Any MCP client can query these to understand your dev environment:

**`repohub://repos`** — All your repositories with metadata

```json
[
  {
    "id": "a1b2c3d4e5f6",
    "name": "my-api",
    "path": "/Users/you/repos/my-api",
    "type": "node",
    "branch": "feature/auth",
    "dirty": true,
    "lastModified": "2025-01-15T...",
    "githubUrl": "https://github.com/you/my-api",
    "isMonorepo": false
  }
]
```

**`repohub://repos/{id}`** — Deep detail on a single repo (includes workspace packages, process status, health summary)

**`repohub://processes`** — All running processes with status

```json
[
  {
    "key": "a1b2c3d4e5f6",
    "repoName": "my-api",
    "command": "pnpm dev",
    "pid": 12345,
    "running": true,
    "startedAt": "2025-01-15T...",
    "recentOutput": "Server listening on port 3001"
  }
]
```

**`repohub://ports`** — All listening localhost ports with process linkage

```json
[
  {
    "port": 3001,
    "pid": 12345,
    "command": "node",
    "processName": "my-api",
    "managed": true,
    "repoId": "a1b2c3d4e5f6"
  }
]
```

**`repohub://git/{repoId}/branches`** — All branches with merge status and tracking info

**`repohub://health/{repoId}`** — Dependency health: vulnerability counts, outdated packages, severity breakdown

**`repohub://github/prs`** — All open PRs across repos with CI status, review state

**`repohub://config`** — Current RepoHub configuration (scan directory, overrides, patterns)

Resources support **subscriptions** — an MCP client can subscribe to `repohub://ports` and get notified when a new port opens or a process crashes. This is built on RepoHub's existing EventEmitter pattern; service events become MCP notifications for free.

### MCP Tools (Take Actions)

Tools are the write side. AI agents can control your dev environment:

| Tool                 | What it does                     | Example prompt                            |
| -------------------- | -------------------------------- | ----------------------------------------- |
| `start_process`      | Start a repo's dev server        | "Start the API server"                    |
| `stop_process`       | Stop a running process           | "Kill whatever's on port 3001"            |
| `restart_process`    | Restart a process                | "Restart the web app"                     |
| `search_code`        | Semantic search across all repos | "Find where auth tokens are validated"    |
| `check_health`       | Run dependency audit for a repo  | "Check my-api for vulnerabilities"        |
| `scan_repos`         | Trigger a fresh repo scan        | "Rescan my repos directory"               |
| `get_process_output` | Get recent terminal output       | "What's the API server saying?"           |
| `list_branches`      | List branches with merge info    | "What branches can I clean up in my-api?" |
| `get_github_prs`     | Fetch PR status                  | "What's the CI status on my open PRs?"    |

Tools require confirmation by default — RepoHub shows a toast or notification when an MCP client wants to start/stop a process, so you're always in control. Read-only tools (search, health check, list) execute immediately.

### What This Unlocks

**In Claude Code:**

```
You: "I'm getting a port conflict starting my frontend"

Claude Code (via MCP):
  → reads repohub://ports → sees port 3000 in use by "my-other-app" PID 8821
  → reads repohub://processes → sees my-other-app has been running since yesterday

"Port 3000 is already in use by your my-other-app dev server
(PID 8821, running since yesterday). Want me to stop it, or
should I change the frontend to use a different port?"
```

**Cross-repo awareness:**

```
You: "What's the state of all my projects?"

Claude Code (via MCP):
  → reads repohub://repos → 5 repos
  → reads repohub://processes → 2 running
  → reads repohub://github/prs → 3 open PRs
  → reads repohub://health across repos

"Here's your dashboard:
• my-api — running on :3001, branch feature/auth (dirty), 2 high vulnerabilities
• web-app — stopped, branch main (clean), PR #42 has failing CI
• shared-lib — stopped, 5 outdated deps (3 major), PR #18 approved and waiting
• cli-tool — stopped, clean
• docs — stopped, clean"
```

**Semantic code search across everything:**

```
You: "Where is rate limiting implemented across my projects?"

Claude Code (via MCP):
  → calls search_code("rate limiting implementation")
  → gets results from my-api and shared-lib

"Rate limiting is implemented in two places:
1. my-api/src/middleware/rateLimit.ts — Express middleware using express-rate-limit
2. shared-lib/src/utils/throttle.ts — Generic throttle utility
The API middleware uses a 100 req/15min window..."
```

### Auto-Discovery & Configuration

RepoHub writes its MCP server configuration to a well-known location so MCP clients find it automatically:

**For Claude Code** — writes to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "repohub": {
      "type": "stdio",
      "command": "/Applications/RepoHub.app/Contents/Resources/mcp-server",
      "args": ["--socket", "/tmp/repohub-mcp.sock"]
    }
  }
}
```

**For Claude Desktop** — writes to `~/Library/Application Support/Claude/claude_desktop_config.json`

On first launch, RepoHub offers to register itself with detected MCP clients. A toggle in Settings lets you enable/disable the MCP server and choose which clients to register with.

### Permission Model

Not everything should be exposed to every AI agent. Settings includes a permission matrix:

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Server Settings                                         │
│                                                             │
│ Server: ● Enabled  ○ Disabled          Port: Auto          │
│                                                             │
│ Registered Clients:                                         │
│ ☑ Claude Code (~/.claude/mcp.json)                         │
│ ☑ Claude Desktop                                            │
│ ☐ Other (manual config)                                     │
│                                                             │
│ Permissions:                                                │
│ ┌──────────────────┬──────┬───────┬──────────┐             │
│ │ Capability       │ Read │ Write │ Confirm  │             │
│ ├──────────────────┼──────┼───────┼──────────┤             │
│ │ Repositories     │  ☑   │  —    │   —      │             │
│ │ Processes        │  ☑   │  ☑    │   ☑      │             │
│ │ Ports            │  ☑   │  ☑    │   ☑      │             │
│ │ Git              │  ☑   │  —    │   —      │             │
│ │ GitHub           │  ☑   │  —    │   —      │             │
│ │ Dependency Health│  ☑   │  ☑    │   ☐      │             │
│ │ Code Search      │  ☑   │  —    │   —      │             │
│ │ Config           │  ☐   │  ☐    │   —      │             │
│ └──────────────────┴──────┴───────┴──────────┘             │
│                                                             │
│ Confirm = show notification before executing write action   │
└─────────────────────────────────────────────────────────────┘
```

## Technical Approach

### Architecture: In-Process MCP Server

The MCP server runs inside RepoHub's main Electron process — no separate binary, no socket coordination, no state sync. It directly calls the existing service layer:

```
┌────────────────────────────────────────────────────┐
│ RepoHub Main Process                                │
│                                                     │
│  ┌─────────────┐  ┌──────────────────────────────┐ │
│  │ IPC Handlers │  │ MCP Server                   │ │
│  │ (renderer)   │  │ (external AI tools)          │ │
│  └──────┬───────┘  └──────────┬───────────────────┘ │
│         │                     │                      │
│         ▼                     ▼                      │
│  ┌──────────────────────────────────────────────┐   │
│  │             Service Layer                     │   │
│  │  RepositoryService, ProcessService,           │   │
│  │  PortService, CodeSearchService, ...          │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

The MCP server and IPC handlers are parallel consumers of the same services. No duplication, no adapter layer — the MCP handler for "list repos" calls `repositoryService.getRepositories()` the same way the IPC handler does.

### New Service: `McpServerService`

```typescript
class McpServerService extends EventEmitter {
  private server: McpServer;
  private transport: StdioTransport | HttpTransport;

  start(config: McpConfig): void;
  stop(): void;
  isRunning(): boolean;

  // Resource registration
  private registerResources(): void;
  private registerTools(): void;

  // Permission checking
  private checkPermission(capability: string, action: 'read' | 'write'): boolean;
  private requestConfirmation(tool: string, args: object): Promise<boolean>;

  // Client registration
  registerWithClaudeCode(): void;
  registerWithClaudeDesktop(): void;
  unregisterAll(): void;
}

interface McpConfig {
  enabled: boolean;
  transport: 'stdio' | 'http';
  port?: number;
  permissions: Record<string, { read: boolean; write: boolean; confirm: boolean }>;
  registeredClients: string[];
}
```

### Resource Implementation

Resources map directly to existing service methods:

```typescript
// repos resource → RepositoryService.getRepositories()
server.resource('repos', 'repohub://repos', async () => {
  const repos = repositoryService.getRepositories();
  return { contents: [{ uri: 'repohub://repos', text: JSON.stringify(repos) }] };
});

// ports resource → PortService.getPorts()
server.resource('ports', 'repohub://ports', async () => {
  const ports = portService.getPorts();
  return { contents: [{ uri: 'repohub://ports', text: JSON.stringify(ports) }] };
});

// health resource → DependencyHealthService.getHealthData()
server.resource('health', 'repohub://health/{repoId}', async uri => {
  const repoId = uri.pathname.split('/').pop();
  const health = dependencyHealthService.getCachedHealth(repoId);
  return { contents: [{ uri: uri.href, text: JSON.stringify(health) }] };
});
```

### Tool Implementation

```typescript
server.tool('start_process', { repoId: z.string(), command: z.string().optional() }, async args => {
  if (!checkPermission('processes', 'write')) throw new Error('Not permitted');
  if (permissions.processes.confirm) {
    const approved = await requestConfirmation('start_process', args);
    if (!approved) return { content: [{ type: 'text', text: 'User denied' }] };
  }
  const repo = repositoryService.getRepository(args.repoId);
  processService.startProcess(repo.id, repo.path, args.command || repo.defaultCommand);
  return { content: [{ type: 'text', text: `Started ${repo.name}` }] };
});

server.tool('search_code', { query: z.string(), limit: z.number().optional() }, async args => {
  if (!checkPermission('codeSearch', 'read')) throw new Error('Not permitted');
  const results = await codeSearchService.search(args.query, args.limit || 10);
  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
});
```

### Resource Subscriptions via EventEmitters

RepoHub services already emit events. Subscriptions pipe these to MCP notifications:

```typescript
// PortService emits 'ports-updated' → MCP resource subscription notification
portService.on('ports-updated', ports => {
  server.notifyResourceUpdated('repohub://ports');
});

processService.on('process-started', () => {
  server.notifyResourceUpdated('repohub://processes');
});

repositoryService.on('repositories-changed', () => {
  server.notifyResourceUpdated('repohub://repos');
});
```

This is nearly free — the events already fire, we just forward them.

### Confirmation UI

When an MCP tool requires confirmation, RepoHub shows an in-app notification:

```typescript
private async requestConfirmation(tool: string, args: object): Promise<boolean> {
  return new Promise((resolve) => {
    // Send to renderer for toast/dialog
    mainWindow.webContents.send('mcp:confirm-action', {
      id: crypto.randomUUID(),
      tool,
      args,
      timestamp: Date.now()
    })

    ipcMain.once('mcp:confirm-response', (_, { id, approved }) => {
      resolve(approved)
    })

    // Auto-deny after 30 seconds
    setTimeout(() => resolve(false), 30_000)
  })
}
```

Renderer shows a minimal toast:

```
┌─────────────────────────────────────────────────┐
│ 🔧 Claude Code wants to: stop_process(my-api)  │
│                              [Allow]  [Deny]    │
└─────────────────────────────────────────────────┘
```

### Transport Strategy

**Phase 1: stdio** — RepoHub ships a thin `mcp-server` CLI entry point that connects to the running RepoHub instance over a Unix socket (`/tmp/repohub-mcp.sock`). MCP clients spawn this CLI, which proxies stdio MCP messages to/from the RepoHub main process. Simple, works with all MCP clients today.

**Phase 2: Streamable HTTP** — RepoHub's main process runs an HTTP MCP endpoint directly (e.g., `http://localhost:19847/mcp`). Clients that support HTTP transport connect directly — no CLI proxy needed. The port is auto-selected and written to a well-known file.

### Client Auto-Registration

On startup (if MCP is enabled), RepoHub:

1. Checks for `~/.claude/mcp.json` → merges in its server entry
2. Checks for Claude Desktop config → merges in its server entry
3. Writes `/tmp/repohub-mcp.json` as a generic discovery file

On quit, optionally cleans up (configurable — some users want the entries to persist so the next RepoHub launch reconnects automatically).

### Dependencies

- `@modelcontextprotocol/sdk` — Official MCP TypeScript SDK (server primitives, transport, protocol handling)
- `zod` — Already common in MCP ecosystem for tool parameter schemas (may already be a dep)

No heavyweight additions. The MCP SDK is small and purpose-built.

### IPC Channels (for Settings & Confirmation UI)

- `mcp:get-config`, `mcp:update-config`
- `mcp:get-status` — returns running state, connected client count
- `mcp:confirm-action`, `mcp:confirm-response` — confirmation flow
- `mcp:register-client`, `mcp:unregister-client`
- Events: `mcp:client-connected`, `mcp:client-disconnected`, `mcp:tool-invoked`

### Renderer Components

- `McpSettingsSection` — New section in Settings view for server config, permissions, client registration
- `McpStatusIndicator` — Small icon in sidebar/header showing server status + connected clients
- `McpConfirmationToast` — Toast component for tool confirmation
- `McpActivityLog` — Optional panel showing recent MCP tool invocations (useful for debugging)

## Wow Moment

You open Claude Code in your API project. You type: "What's happening across all my projects?"

Claude Code reads `repohub://repos`, `repohub://processes`, `repohub://ports`, `repohub://github/prs`, and `repohub://health` for each repo — all in parallel, all instant because RepoHub already has the data cached.

In under a second, Claude responds with a full situational report: which servers are running, what ports they're on, which repos have dirty git state, which PRs need attention, and which projects have security vulnerabilities. It knows your web-app crashed 5 minutes ago because it subscribed to process events. It knows your API has a critical CVE because it read the cached health data.

You didn't paste anything. You didn't run any commands. You didn't switch windows. Claude Code just _knew_, because RepoHub told it.

Then you say "stop the API and start the frontend instead." Claude calls `stop_process` and `start_process` through MCP. RepoHub shows a quick confirmation toast. You tap Allow. Done.

Your AI tools now have the same ambient awareness of your dev environment that you have when you glance at RepoHub. That's the unlock — AI that understands your local machine, not just the file it's editing.

## Scope

- **Phase 1**: Stdio transport, read-only resources (repos, processes, ports, git state), search_code tool, Settings UI for enable/disable, auto-registration with Claude Code
- **Phase 2**: Write tools (start/stop process, health check, kill port) with confirmation flow, permission matrix, resource subscriptions, Claude Desktop registration
- **Phase 3**: HTTP transport, activity log, connected client indicator, cross-repo semantic search improvements, MCP prompts for common workflows
- **Phase 4**: Dynamic resource templates (e.g., `repohub://file/{repoId}/{path}`), agent context injection (tie into Agent Command Center), MCP sampling for RepoHub-initiated AI queries

## Relationship to Agent Command Center

These two proposals are complementary, not competing:

- **Agent Command Center** = RepoHub launches and manages AI agents (inbound)
- **MCP Dev Context Server** = External AI agents query RepoHub for context (outbound)

Together they create a complete loop: agents launched from the Command Center automatically get MCP access to RepoHub's context, and external agents (Claude Code in your terminal) get the same access without being launched from RepoHub. The Agent Command Center could even use MCP internally as its context-sharing mechanism, replacing the file-based scratchpad with MCP resources.
