# Agent Command Center — Implementation Plan

Detailed implementation docs for building the Agent Command Center feature. This transforms RepoHub from a repo dashboard into a multi-agent AI command center.

## Key Discovery: Claude Code WebSocket Protocol

The single most important technical finding is from **The Vibe Company's Companion** app. Claude Code CLI has an undocumented `--sdk-url` flag that connects to a WebSocket server instead of running in a terminal. This gives us:

- **Structured JSON messages** instead of PTY output parsing
- **Permission request/response flow** — approve/deny/modify tool calls from the UI
- **Session persistence** — resume sessions via `--resume` with CLI session IDs
- **Real-time streaming** — token-by-token output via `stream_event` messages
- **Structured tool visibility** — every tool call as a typed JSON object with input/output

This is a fundamentally better integration path than spawning Claude in a PTY and parsing terminal output. The entire architecture should be built around this.

## Documents

| Doc | Contents |
|-----|----------|
| [01-architecture.md](./01-architecture.md) | System architecture, process model, data flow |
| [02-websocket-protocol.md](./02-websocket-protocol.md) | Claude Code WebSocket integration protocol |
| [03-agent-service.md](./03-agent-service.md) | AgentService, session management, role system |
| [04-renderer-components.md](./04-renderer-components.md) | UI components, views, state management |
| [05-ipc-channels.md](./05-ipc-channels.md) | Complete IPC channel specification |
| [06-phased-rollout.md](./06-phased-rollout.md) | Phase-by-phase implementation plan |

## Reference Materials

- **Proposal docs**: `docs/proposals/agent-command-center.md`, `agent-experience.md`, `context-management.md`, `mcp-dev-context-server.md`
- **UI Mockups**: `_reference/src/mockups/AgentCommandCenter.tsx`, `ContextManagement.tsx`, `AgentDiffView.tsx`
- **Companion repo**: `_reference/companion/` — WebSocket protocol reference implementation
- **Maestro repo**: `_reference/Maestro/` — Multi-agent orchestration patterns

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│ RepoHub Main Process                                            │
│                                                                  │
│  ┌──────────────┐   WebSocket    ┌────────────────────────────┐ │
│  │ AgentService  │◄─────────────►│ Claude Code CLI processes   │ │
│  │               │   (per agent) │ (spawned with --sdk-url)    │ │
│  │ • launch      │               │                             │ │
│  │ • stop        │   NDJSON ↔ JSON│ Agent 1: my-api/coder      │ │
│  │ • message     │   bidirectional│ Agent 2: web-app/reviewer   │ │
│  │ • approve     │               │ Agent 3: shared-lib/research│ │
│  └──────┬───────┘               └────────────────────────────┘ │
│         │ IPC                                                    │
│  ┌──────┴───────┐                                               │
│  │ IPC Handlers  │                                               │
│  │ agent.*       │                                               │
│  └──────┬───────┘                                               │
├─────────┤────────────────────────────────────────────────────────┤
│  Preload│Bridge                                                  │
├─────────┤────────────────────────────────────────────────────────┤
│  ┌──────┴───────┐   ┌──────────┐   ┌─────────────────────────┐ │
│  │ useAgents()   │──►│ agentStore│──►│ AgentCommandCenter view │ │
│  │ hook          │   │ (Zustand) │   │ • FocusedView           │ │
│  └──────────────┘   └──────────┘   │ • GridView               │ │
│                                     │ • AgentTerminal          │ │
│  Renderer Process                   │ • LaunchPanel            │ │
│                                     └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent integration | WebSocket (`--sdk-url`) | Structured messages > PTY parsing. Companion proves it works. |
| WebSocket server | Bun/Hono in main process | Lightweight, runs in Electron's Node.js. One server, many agents. |
| Session persistence | CLI session IDs + electron-store | Claude Code `--resume` restores conversation. We store metadata. |
| Permission flow | WebSocket control_request/response | UI-driven approve/deny/modify per tool call. |
| Message format | NDJSON (CLI) ↔ JSON (internal) | Match what Claude Code expects. Translate at the bridge. |
| State management | Zustand store (agentStore) | Consistent with existing stores (repositoryStore, processStore). |
| UI architecture | Focused + Grid views | Mockups already prototyped in _reference. Match proposal spec. |
