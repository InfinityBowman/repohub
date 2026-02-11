# Context Management & Session Intelligence

**Category**: Showstopper
**Effort**: High
**Depends on**: Agent Command Center
**Payoff**: You stop losing context. You see exactly what your agent knows, trim what it doesn't need, and transplant knowledge between agents like moving organs between patients.

## The Problem

When you run Claude Code in a terminal, the context window is a black box. You know it fills up. You know eventually the agent starts forgetting things. But you can't see what's in there, you can't remove the 500-line webpack output that's eating 4k tokens, and when you need to start a new session, you lose everything — or you awkwardly paste a summary and hope for the best.

With multiple agents running in the Agent Command Center, this gets worse:
- Agent A discovers something Agent B needs, but the shared scratchpad is just key-value strings
- An agent's context fills up with verbose tool output from early exploration, leaving no room for the actual task
- You want to split a conversation: "take everything about the auth work into a new agent, leave the rest here"
- You want to merge: "this researcher found the answer, inject its findings into the coder's context"

The context window is the most important resource an AI agent has, and right now it's completely unmanaged.

## The Feature

### Context Block Viewer

Every agent session's context is visualized as a **vertical stack of blocks** — a timeline of the conversation, but interactive. Each block represents a logical unit:

```
┌─ Context · my-api / Coder ─────────────────── 68% full ─────┐
│                                                               │
│  ┌─ System ──────────────────────────── 1.2k tokens ──────┐  │
│  │ 📌 Role: Coder · Repo: my-api · Supervised mode        │  │
│  │ System prompt, CLAUDE.md, shared context injected       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ You ─────────────────────────────── 42 tokens ────────┐  │
│  │ Add rate limiting to all API endpoints using            │  │
│  │ express-rate-limit                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Agent ───────────────────────────── 180 tokens ───────┐  │
│  │ I'll add rate limiting to the API. Let me first check   │  │
│  │ the existing middleware setup and route structure.       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Tool: Read ──────────────────────── 890 tokens ───────┐  │
│  │ 📄 src/middleware/index.ts (42 lines)                   │  │
│  │ exports auth, cors, logger middleware                    │  │
│  │ [Collapse] [Remove] [Move to Context]                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Tool: Read ──────────────────────── 2.1k tokens ──────┐  │
│  │ 📄 src/routes/api.ts (118 lines)                        │  │
│  │ 6 route handlers, Express Router                        │  │
│  │ [Collapse] [Remove] [Move to Context]                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Tool: Bash ──────────────────────── 340 tokens ───────┐  │
│  │ $ pnpm add express-rate-limit                           │  │
│  │ Added 1 package in 1.2s                                 │  │
│  │ [Collapse] [Remove]                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Agent ───────────────────────────── 520 tokens ───────┐  │
│  │ I can see you have Express with middleware in            │  │
│  │ src/middleware/. I'll create a rate limiter middleware... │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Tool: Write ─────────────────────── 680 tokens ───────┐  │
│  │ 📝 src/middleware/rateLimiter.ts (new, 34 lines)        │  │
│  │ Rate limiter with per-route config                      │  │
│  │ [Collapse] [Remove]                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  Total: 5.9k / 8.7k tokens          [Compact] [Export]       │
└───────────────────────────────────────────────────────────────┘
```

Each block shows:
- **Type**: System, You, Agent, Tool (Read/Write/Bash/Grep/etc.)
- **Token count**: How much context this block consumes
- **Preview**: Collapsed summary of the content (expandable to full)
- **Actions**: Operations you can perform on the block

### Block Operations

**Remove** — Delete a block from context. That 2.1k-token file read from early exploration that's no longer relevant? Gone. The agent won't remember it, but it has room for new things. Useful for:
- Verbose tool outputs (npm install logs, test output, large file reads)
- Early exploration that led nowhere
- Outdated information the agent read before you corrected course

**Collapse** — Replace a block with a compressed summary. The 890-token file read becomes a 50-token summary: "src/middleware/index.ts: exports auth(), cors(), logger() middleware functions." The agent retains the knowledge in compressed form. This is like manual compaction — you choose what gets summarized rather than letting auto-compact decide.

**Pin** — Mark a block as essential. Pinned blocks survive auto-compaction and are never removed. Use this for the critical discovery, the key architecture decision, the user requirement that must not be forgotten.

**Edit** — Modify a block's content. Fix a mistake in your prompt, annotate an agent response with corrections, or trim a tool output to just the relevant parts. The agent sees your edited version going forward.

**Move to New Agent** — Select one or more blocks and use them to seed a new agent session. The blocks become the initial context of the new agent. This is the killer feature: context transplantation.

**Copy to Agent** — Copy blocks into another running agent's context (appended as a "context injection" block). This is richer than the shared scratchpad — you're transferring actual conversation context, not just key-value notes.

### Context Budget Bar

Always visible in the agent info bar — a thin progress bar showing context usage:

```
[████████████████████░░░░░░░░░░] 68% · 5.9k / 8.7k tokens
```

- **Green** (0–60%): Plenty of room
- **Yellow** (60–80%): Starting to fill. Consider removing old tool outputs.
- **Red** (80–95%): Critical. Agent will start losing coherence soon.
- **Pulsing red** (95%+): Context overflow imminent. Auto-compact recommended.

The bar is clickable — opens the full Context Block Viewer as a side panel or overlay.

### Smart Compaction

When context gets full, instead of the blunt "summarize everything" approach, the block viewer enables **selective compaction**:

**Auto-compact suggestions**: The UI highlights blocks that are good candidates for removal or collapse, based on:
- Token size (large blocks save the most space)
- Age (older blocks are less likely to be relevant)
- Type (tool outputs are usually safe to collapse; user messages and agent plans are not)
- Redundancy (if the agent read a file, then wrote to it, the read is probably stale)

```
┌─ ⚠ Context at 92% ──────────────────────────────────────────┐
│                                                               │
│  Suggested removals (would free 3.4k tokens):                 │
│                                                               │
│  ☑ Tool: Read · package.json (340 tokens)                     │
│    Reason: Agent already has this info from later exploration  │
│                                                               │
│  ☑ Tool: Bash · pnpm add express-rate-limit (340 tokens)      │
│    Reason: Installation complete, output no longer needed      │
│                                                               │
│  ☑ Tool: Read · src/routes/api.ts (2.1k tokens)               │
│    Reason: File was read 8 messages ago, agent wrote to it     │
│    since — can collapse to summary                             │
│                                                               │
│  ☐ Tool: Read · src/middleware/index.ts (890 tokens)           │
│    Reason: Referenced in agent's most recent plan              │
│                                                               │
│  [Apply Selected] [Compact All] [Dismiss]                     │
└───────────────────────────────────────────────────────────────┘
```

The user checks which suggestions to accept, clicks "Apply Selected", and context drops from 92% to 55%. The agent continues working with a clean, curated context.

### Context Transfer Between Agents

The most powerful operation: moving context between agents.

**Scenario**: You have a Researcher agent that spent 10 minutes exploring how auth works in your codebase. Now you want a Coder agent to implement changes based on those findings. Instead of re-explaining everything:

1. Open the Researcher's Context Block Viewer
2. Select the blocks that contain the key findings (agent summaries, relevant file reads)
3. Click "Move to New Agent" or "Copy to Agent"
4. A new Coder agent starts with those blocks pre-loaded as context

```
┌─ Transfer Context ───────────────────────────────────────────┐
│                                                               │
│  From: shared-lib / Researcher                                │
│  Selected: 3 blocks (1.8k tokens)                             │
│                                                               │
│  ┌─ Agent ─── 520 tokens ─────────────────────────────────┐  │
│  │ The validation module uses a provider pattern. Zod and  │  │
│  │ Arktype both implement ValidatorProvider interface...    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─ Tool: Read ─── 890 tokens ────────────────────────────┐  │
│  │ src/validation/providers/zod.ts                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─ Agent ─── 390 tokens ─────────────────────────────────┐  │
│  │ Recommendation: Add an adapter layer that normalizes... │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Target: ○ New Agent   ● Existing Agent                       │
│  Agent:  [my-api / Coder ▾]                                   │
│                                                               │
│  Inject as:                                                   │
│    ● Context block (agent sees it as prior knowledge)         │
│    ○ User message (agent sees it as instruction from you)     │
│                                                               │
│  [Transfer] [Cancel]                                          │
└───────────────────────────────────────────────────────────────┘
```

The receiving agent gets a special "Transferred Context" block:

```
┌─ Transferred from shared-lib / Researcher ─── 1.8k tokens ─┐
│ 📋 3 blocks transferred · Validation architecture findings   │
│ [Expand] [Remove]                                            │
└──────────────────────────────────────────────────────────────┘
```

### Session Snapshots

Save the current state of an agent's context as a named snapshot. Useful for:
- **Checkpointing** before a risky operation: "save this state, then let the agent try something wild"
- **Branching**: Restore a snapshot and take a different approach
- **Templates**: A well-primed context (system prompt + key file reads + architecture notes) saved as a reusable starting point

```
Snapshots:
  💾 "Before refactor" — 4.2k tokens · 12 blocks · 3 min ago
  💾 "Auth research done" — 6.1k tokens · 18 blocks · 10 min ago

  [Restore] [Delete] [New Agent from Snapshot]
```

### Integration with Shared Context

The existing shared context scratchpad (key-value pairs visible to all agents) becomes a special case of context management:

- **Promote to shared context**: Select an agent block → "Share this finding" → it becomes a shared context entry visible to all agents
- **Inject shared context**: From any agent, pull shared context entries into the agent's context as blocks
- Shared context entries show their source agent and can link back to the original block

## Technical Approach

### Context Introspection

The primary technical challenge: how do we see what's in Claude Code's context window?

**Path 1: Claude Code CLI Metadata** (preferred)
If Claude Code exposes conversation history via its CLI or SDK — through flags like `--output-conversation`, a local API, or session files — we parse that into blocks. Claude Code already stores session data; we need to read it.

**Path 2: PTY Output Parsing**
Parse the PTY output stream in real-time. We already render agent terminal output — we can also parse it into structured blocks. Each user message, agent response, and tool use becomes a block. Token counts are estimated (using tiktoken or similar).

**Path 3: Session File Reading**
Claude Code stores sessions in `~/.claude/projects/`. Read the JSONL session files directly to reconstruct the block timeline. This gives us the most accurate view but requires understanding Claude Code's internal format.

Likely approach: Start with Path 2 (we already have the PTY stream), enhance with Path 3 for accuracy, and adopt Path 1 when SDK support is available.

### Token Estimation

For context budget visualization:
- Use a fast tokenizer (tiktoken/cl100k_base or the Anthropic tokenizer) to count tokens per block
- Cache counts — blocks don't change after creation
- System prompt tokens estimated from role config + CLAUDE.md size
- Update the budget bar in real-time as new blocks arrive

### Block Operations Implementation

**Remove**: Send a "context edit" instruction to Claude Code (if supported), or track removed blocks locally and re-inject the remaining context into a new session via `--resume` with filtered history.

**Collapse**: Generate a summary of the block (using a fast, cheap model call — Haiku) and replace the block content. If Claude Code supports context editing, apply directly. Otherwise, track as a local override.

**Transfer**: Serialize selected blocks as a context document. When creating the target agent session, inject the document as an initial system message or append file.

**Pin**: Local metadata flag. When auto-compaction runs, pinned blocks are excluded from summarization candidates.

### New IPC Channels

- `agent:get-context-blocks` — Returns parsed block list for an agent session
- `agent:remove-block`, `agent:collapse-block`, `agent:pin-block`, `agent:edit-block`
- `agent:transfer-blocks` — Copy blocks between agents
- `agent:get-context-usage` — Token count and percentage
- `agent:create-snapshot`, `agent:restore-snapshot`, `agent:list-snapshots`
- `agent:compact-suggest` — Get AI-generated compaction suggestions
- Events: `agent:context-updated`, `agent:context-warning` (yellow/red thresholds)

### New Service: `ContextService`

```typescript
class ContextService extends EventEmitter {
  getBlocks(agentId: string): ContextBlock[]
  removeBlock(agentId: string, blockId: string): void
  collapseBlock(agentId: string, blockId: string): Promise<void>  // async: needs summarization
  pinBlock(agentId: string, blockId: string, pinned: boolean): void
  editBlock(agentId: string, blockId: string, newContent: string): void

  transferBlocks(sourceAgentId: string, blockIds: string[], target: TransferTarget): void

  getUsage(agentId: string): { tokens: number; maxTokens: number; percentage: number }

  createSnapshot(agentId: string, name: string): string  // returns snapshotId
  restoreSnapshot(agentId: string, snapshotId: string): void

  suggestCompaction(agentId: string): CompactionSuggestion[]
  applyCompaction(agentId: string, suggestions: CompactionSuggestion[]): void
}

interface ContextBlock {
  id: string
  type: 'system' | 'user' | 'agent' | 'tool' | 'transfer'
  toolName?: string            // Read, Write, Bash, Grep, etc.
  content: string
  summary?: string             // collapsed version
  tokens: number
  timestamp: string
  pinned: boolean
  collapsed: boolean
  source?: string              // for transferred blocks: "shared-lib / Researcher"
}

interface TransferTarget {
  type: 'new-agent' | 'existing-agent'
  agentId?: string             // for existing agent
  agentConfig?: AgentConfig    // for new agent
  injectAs: 'context' | 'user-message'
}

interface CompactionSuggestion {
  blockId: string
  action: 'remove' | 'collapse'
  reason: string
  tokensSaved: number
}
```

### Renderer Components

- `ContextBlockViewer` — Main panel showing the block stack with actions. Opens as a slide-over panel from the right edge, or as a tab within the Focused view.
- `ContextBudgetBar` — Thin colored progress bar in the agent info bar. Clickable to open the block viewer.
- `ContextTransferDialog` — Inline form for configuring block transfer (target agent, inject mode).
- `CompactionSuggestionPanel` — Warning banner + checklist of suggested removals when context is high.
- `SnapshotManager` — List of saved snapshots with restore/delete/new-agent actions.

### Storage

- Block metadata cached in memory per active agent session
- Snapshots saved to `~/Library/Application Support/repohub/agent-snapshots/{agentId}/`
- Each snapshot: JSON file with block list + metadata
- Token counts cached alongside blocks (invalidated only if block content changes)

## Wow Moment

You have a Researcher agent that spent 5 minutes mapping how your monorepo's auth system works — reading files, tracing imports, summarizing the architecture. Now you need a Coder agent to refactor it. You open the Researcher's context, select the 3 blocks with the key findings, and hit "New Agent from Selection." A Coder agent appears, already knowing everything the Researcher discovered, with 80% of its context window still free for the actual work.

Later, your Coder agent is at 90% context. You open the block viewer and see that 40% of the context is tool outputs from early file reads that are no longer relevant — the agent already incorporated that knowledge into its plan. You check the suggested removals, hit "Apply," and the agent drops to 50%. It continues working with a clean, focused context. No restart. No lost progress. No re-explaining.

You save a snapshot called "Auth research done" before letting the agent attempt a risky refactor. It goes sideways. You restore the snapshot. The agent is back to the clean state, ready to try a different approach.

## Scope

- **Phase 1**: Context budget bar (token count + percentage) in agent info bar. Block viewer with read-only block list (type, tokens, preview). Basic remove and pin operations.
- **Phase 2**: Collapse (with AI summarization), edit, smart compaction suggestions. Snapshot save/restore.
- **Phase 3**: Context transfer between agents. "New Agent from Selection." Transferred context blocks.
- **Phase 4**: Deep Claude Code SDK integration for native context manipulation. Real-time block streaming. Shared context promotion (block → shared scratchpad).

## References

- **Maestro** (`_reference/Maestro/`): Context compaction with multi-pass compression, context usage gauge with yellow/red thresholds, context merging between tabs, "Compact & Continue" button. Maestro's approach is automatic and opaque — ours makes it visible and user-controlled.
- **Agent Command Center proposal**: This feature lives within the Agent Command Center as a panel/overlay. Depends on agents being running and managed by RepoHub.
