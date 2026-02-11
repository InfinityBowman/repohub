# 02 — WebSocket Protocol

## Overview

This document specifies the WebSocket-based protocol for communicating with Claude Code CLI processes. Derived from reverse-engineering The Vibe Company's Companion app, which uses Claude Code's undocumented `--sdk-url` flag.

## CLI Launch Command

```bash
claude \
  --sdk-url ws://127.0.0.1:{port}/ws/cli/{sessionId} \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  -p ""
```

**Flags explained:**

- `--sdk-url`: Connect to WebSocket server instead of running in terminal
- `--print`: Non-interactive mode (no TTY prompts)
- `--output-format stream-json`: NDJSON output (one JSON object per line)
- `--input-format stream-json`: Accept NDJSON input
- `--verbose`: Include `stream_event` messages for token streaming
- `-p ""`: Empty initial prompt (we send the real prompt via WebSocket)

**Additional flags per launch:**

- `--cwd {repoPath}`: Set working directory to the repo
- `--system-prompt {text}`: Role-specific system prompt
- `--resume {cliSessionId}`: Resume a previous session
- `--permission-mode {mode}`: Set permission behavior

## Message Protocol

### Direction: CLI → RepoHub (NDJSON)

Messages arrive as newline-delimited JSON. Each line is one complete JSON object.

#### `system/init`

First message after connection. Contains capabilities.

```typescript
{
  type: "system/init",
  session_id: string,      // Claude's internal session ID (for --resume)
  tools: Tool[],           // Available tools (Read, Write, Bash, etc.)
  model: string,           // e.g., "claude-opus-4-6"
  permission_mode: string, // "default", "acceptEdits", "bypassPermissions", etc.
  cwd: string,
  mcp_servers?: McpServerStatus[]
}
```

**What to do**: Store `session_id` as `cliSessionId` for resume support. Store model and tools for UI display.

#### `assistant`

Claude's response message with content blocks.

```typescript
{
  type: "assistant",
  message: {
    id: string,
    role: "assistant",
    content: ContentBlock[],
    usage: { input_tokens: number, output_tokens: number, cache_read_input_tokens?: number },
    model: string,
    stop_reason: string
  },
  parent_tool_use_id: string | null  // Non-null if this is a subagent response
}

type ContentBlock =
  | { type: "text", text: string }
  | { type: "tool_use", id: string, name: string, input: Record<string, unknown> }
  | { type: "tool_result", tool_use_id: string, content: string | ContentBlock[], is_error?: boolean }
  | { type: "thinking", thinking: string, budget_tokens?: number }
```

**What to do**: Parse content blocks. `text` blocks are agent responses. `tool_use` blocks are tool calls (render with tool name and input). `tool_result` blocks are results. Append to message history.

#### `control_request`

Permission request — the most critical message type.

```typescript
{
  type: "control_request",
  request_id: string,       // UUID for correlating response
  request: {
    subtype: "can_use_tool",
    tool_name: string,      // "Bash", "Write", "Read", "Edit", "Grep", etc.
    input: Record<string, unknown>,  // Tool-specific input
    tool_use_id: string,
    description?: string,
    agent_id?: string       // If from a subagent
  }
}
```

**What to do**: Store in `pendingPermissions`. Emit to renderer for approval UI. In autonomous mode, auto-approve based on role permissions.

#### `result`

Marks the end of a query turn (not necessarily the end of the session).

```typescript
{
  type: "result",
  subtype: "success" | "error",
  duration_ms: number,
  duration_api_ms: number,
  num_turns: number,
  is_error: boolean,
  total_cost_usd: number,
  usage: {
    input_tokens: number,
    output_tokens: number,
    cache_read_input_tokens: number,
    cache_creation_input_tokens: number
  },
  session_id: string
}
```

**What to do**: Update session stats (tokens, cost, duration). If the agent was answering a user message, mark as ready for next input. Update context usage estimate.

#### `stream_event`

Real-time token streaming (when `--verbose` is used).

```typescript
{
  type: "stream_event",
  event: "content_block_delta",
  data: {
    type: "text_delta" | "thinking_delta",
    text?: string,
    thinking?: string
  }
}
```

**What to do**: Forward to renderer for live typing effect. Accumulate into a buffer; flush on `assistant` message.

#### Other CLI Messages

| Type            | Purpose                              | Action                     |
| --------------- | ------------------------------------ | -------------------------- |
| `tool_progress` | Heartbeat during long tool execution | Update "working" indicator |
| `keep_alive`    | Liveness check                       | Ignore                     |
| `auth_status`   | Authentication flow                  | Handle if auth needed      |

### Direction: RepoHub → CLI (NDJSON)

Messages sent to the CLI must be newline-terminated JSON.

#### User Message

```typescript
{
  type: "user_message",
  content: string
}
// Sent as: JSON.stringify(msg) + "\n"
```

#### Permission Response

```typescript
{
  type: "control_response",
  response: {
    subtype: "success",
    request_id: string,
    response: {
      behavior: "allow" | "deny",
      updatedInput?: Record<string, unknown>,  // Can modify tool input!
      updatedPermissions?: PermissionUpdate[],
      message?: string  // Reason for denial
    }
  }
}
```

**`updatedInput`**: This is powerful — you can modify what the tool does. For example, sanitize a bash command or restrict file paths. Must be provided (use original input if no changes).

**`updatedPermissions`**: Add session-level permission rules so the agent doesn't ask again for similar operations.

```typescript
interface PermissionUpdate {
  type: 'addRules';
  rules: Array<{ toolName: string; ruleContent: string }>;
  behavior: 'allow' | 'deny';
  destination: 'session';
}
```

#### Control Requests (RepoHub → CLI)

```typescript
// Interrupt current turn
{ type: "control_request", request: { subtype: "interrupt" } }

// Change model mid-session
{ type: "control_request", request: { subtype: "set_model", model: "claude-sonnet-4-5-20250929" } }

// Change permission mode
{ type: "control_request", request: { subtype: "set_permission_mode", mode: "bypassPermissions" } }
```

## Permission Modes

| Mode                | Behavior                 | RepoHub Use               |
| ------------------- | ------------------------ | ------------------------- |
| `default`           | Ask for each tool        | Supervised mode           |
| `acceptEdits`       | Auto-approve file edits  | Semi-autonomous           |
| `bypassPermissions` | Everything auto-approved | Autonomous mode           |
| `plan`              | Read-only exploration    | Researcher/Reviewer roles |

**Mapping to RepoHub roles:**

```typescript
const ROLE_PERMISSION_MAP: Record<AgentRole, string> = {
  coder: 'default', // Supervised: ask for each tool
  reviewer: 'plan', // Read-only
  researcher: 'plan', // Read-only
  architect: 'plan', // Read-only (suggests, doesn't write)
  tester: 'default', // Needs to run commands
  security: 'plan', // Read-only auditing
};

// In autonomous mode, coders/testers use 'bypassPermissions'
// In autonomous mode, read-only roles use 'plan' (already read-only)
```

## Session Lifecycle

```
1. RepoHub spawns CLI with --sdk-url
   State: STARTING

2. CLI connects via WebSocket
   State: CONNECTED

3. CLI sends system/init
   State: INITIALIZED
   → Store cliSessionId, model, tools

4. RepoHub sends first user_message (task)
   State: WORKING

5. CLI sends assistant messages, control_requests, stream_events
   State: WORKING / WAITING_FOR_PERMISSION

6. CLI sends result (turn complete)
   State: IDLE (ready for next message)

7. User sends another message or session ends
   State: WORKING or COMPLETED

8. CLI process exits
   State: COMPLETED or ERROR
```

## Message History Format

For replay when renderer connects or when resuming:

```typescript
interface AgentMessage {
  id: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'permission' | 'error';
  timestamp: number;

  // For user messages
  content?: string;

  // For assistant messages
  contentBlocks?: ContentBlock[];
  usage?: { input_tokens: number; output_tokens: number };

  // For tool use
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;

  // For tool result
  toolResult?: string | ContentBlock[];
  isError?: boolean;

  // For permission requests
  permissionRequest?: { requestId: string; toolName: string; input: Record<string, unknown> };
  permissionResponse?: { behavior: 'allow' | 'deny' };
}
```

## Pending Message Queue

If the user sends a message before the CLI has connected:

```typescript
// In AgentSession
pendingMessages: string[] = []

// When user sends a message and CLI isn't connected yet:
session.pendingMessages.push(JSON.stringify(msg) + "\n")

// When CLI connects and sends system/init:
for (const ndjson of session.pendingMessages) {
  session.cliSocket.send(ndjson)
}
session.pendingMessages = []
```

## WebSocket Server Implementation

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

class AgentWebSocketServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private port: number = 0;

  constructor(private agentService: AgentService) {}

  async start(): Promise<number> {
    this.httpServer = http.createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, `http://localhost`);
      const match = url.pathname.match(/^\/ws\/cli\/(.+)$/);
      if (!match) {
        ws.close(4000, 'Invalid path');
        return;
      }

      const sessionId = match[1];
      this.agentService.handleCLIConnection(sessionId, ws);
    });

    return new Promise(resolve => {
      this.httpServer.listen(0, '127.0.0.1', () => {
        const addr = this.httpServer.address() as { port: number };
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  stop(): void {
    this.wss.close();
    this.httpServer.close();
  }
}
```

## NDJSON Parsing

Claude CLI sends newline-delimited JSON. A single WebSocket message may contain multiple JSON lines:

```typescript
function parseNDJSON(data: string): object[] {
  return data
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// In the WebSocket message handler:
ws.on('message', raw => {
  const text = raw.toString();
  const messages = parseNDJSON(text);
  for (const msg of messages) {
    this.routeCLIMessage(sessionId, msg);
  }
});
```

## Cost Tracking from Protocol

The `result` message includes `total_cost_usd` directly from Claude Code. No need to estimate:

```typescript
// On receiving a result message:
session.totalCostUsd = result.total_cost_usd; // Cumulative for session
session.totalTokens = {
  input: result.usage.input_tokens,
  output: result.usage.output_tokens,
  cache: result.usage.cache_read_input_tokens,
};
```

## Differences from Companion's Architecture

Companion runs a standalone Bun server that bridges between browser WebSockets and CLI WebSockets. RepoHub's architecture is simpler:

| Companion                                      | RepoHub                                         |
| ---------------------------------------------- | ----------------------------------------------- |
| Browser ↔ WebSocket ↔ Server ↔ WebSocket ↔ CLI | Renderer ↔ IPC ↔ AgentService ↔ WebSocket ↔ CLI |
| Server translates NDJSON ↔ JSON for browser    | AgentService translates NDJSON internally       |
| Browser needs WebSocket client                 | Renderer uses standard IPC (already exists)     |
| REST API for session management                | IPC channels for session management             |

RepoHub doesn't need a browser-facing WebSocket because the renderer communicates via Electron IPC. The WebSocket server only faces inward (toward Claude CLI processes). This is simpler and more secure.
