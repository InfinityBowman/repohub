Agent Command Center - Phase 1 MVP

New Files Created (13 files)

Main Process:

- src/main/types/agent.types.ts — All type definitions (AgentState, AgentSession, AgentMessage, PermissionRequest,
  built-in roles)
- src/main/services/AgentWebSocketServer.ts — Local WebSocket server on random localhost port for Claude CLI SDK
  communication
- src/main/services/AgentService.ts — Agent lifecycle management: spawn claude CLI with --sdk-url, route NDJSON
  messages, manage sessions/permissions/cost tracking
- src/main/ipc/agent.handler.ts — IPC handler registration + event forwarding

Renderer:

- src/renderer/src/store/agentStore.ts — Zustand store for agents, messages, permissions, streaming state
- src/renderer/src/hooks/useAgents.ts — IPC listeners (StrictMode-safe) + action wrappers
- src/renderer/src/components/agents/AgentLaunchPanel.tsx — Repo picker, role cards, task input, mode toggle
- src/renderer/src/components/agents/AgentTerminal.tsx — Structured message renderer with collapsible tool calls
- src/renderer/src/components/agents/InfoBar.tsx — Role badge, state indicator, elapsed time, cost, stop button
- src/renderer/src/components/agents/MessageInput.tsx — Follow-up message input with Enter/Shift+Enter handling
- src/renderer/src/components/agents/PermissionRequestInline.tsx — Inline permission cards with Allow/Deny buttons
- src/renderer/src/components/agents/EmptyState.tsx — Empty state with launch button
- src/renderer/src/views/AgentCommandCenterView.tsx — Main view orchestrating all components

Files Modified (8 files)

- src/main/index.ts — Added AgentWebSocketServer + AgentService initialization and shutdown
- src/main/ipc/index.ts — Registered agent handlers
- src/preload/index.ts — Added agent namespace + 7 event listeners
- src/renderer/src/types/index.ts — Added all agent type declarations + window.electron extensions
- src/renderer/src/App.tsx — Added /agents route + useAgentListeners()
- src/renderer/src/components/layout/Sidebar.tsx — Added Agents nav item with Bot icon
- docs/features.md — Documented Agent Command Center feature
- docs/development.md — Updated project structure and IPC channel table

Dependencies Added

- ws (runtime) — WebSocket server for Claude CLI communication
- @types/ws (dev) — TypeScript types
