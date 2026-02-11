# Agent Experience & Operations

**Category**: Showstopper
**Effort**: High (cumulative — individual items range from trivial to medium)
**Depends on**: Agent Command Center
**Payoff**: The Agent Command Center goes from "I can see my agents" to "I'm fully in control of my agents." Cost awareness, session persistence, output management, isolation, notifications — the operational layer that makes multi-agent workflows actually sustainable.

## The Problem

The Agent Command Center (as proposed) handles launching, viewing, and interacting with agents. But running agents day-to-day surfaces a second tier of needs:

- You have no idea how much money your agents are burning. Three agents running for 20 minutes — is that $0.50 or $5.00?
- An agent finishes a task, you close the tab. A week later you want to pick up where it left off. Gone.
- An agent dumps 300 lines of npm install output and you're scrolling through noise to find the one line that matters.
- You leave for lunch, come back, your Mac slept, and your agents have been stale for an hour.
- Two agents are both modifying `src/utils/auth.ts` in the same repo. Merge conflict incoming.
- An agent finishes while you're in the Grid view watching a different agent. You don't notice for 10 minutes.

These aren't flashy features — they're the operational backbone that makes the system reliable.

## The Features

### 1. Token & Cost Tracking

Every agent session displays real-time token usage and estimated cost directly in the UI.

**In the info bar** (Focused view):
```
Add rate limiting to endpoints · ⏱ 4m · 18.2k tokens · ~$0.07
```

**In the tile footer** (Grid view):
```
⏱ 4m · 18.2k tokens · ~$0.07
```

**Aggregate in the header** (total across all active agents):
```
Agents  ● 2 working · ⬤ 1 waiting            Total: 42.6k tokens · ~$0.18
```

**Breakdown available on click** — popover showing per-agent costs:
```
┌─ Session Costs ─────────────────────────────────┐
│                                                  │
│  my-api / Coder        18.2k tokens    ~$0.07   │
│  web-app / Reviewer     8.4k tokens    ~$0.03   │
│  shared-lib / Research  3.1k tokens    ~$0.01   │
│  ─────────────────────────────────────────────── │
│  Total (this session)  29.7k tokens    ~$0.11   │
│  Today                 142k tokens     ~$0.58   │
│                                                  │
│  [View Full Stats]                               │
└──────────────────────────────────────────────────┘
```

**Full stats page** (accessible from Settings or the cost popover):
- Per-agent breakdown over time
- Daily/weekly/monthly cost trends
- Token usage by type (input/output/cache)
- Most expensive sessions

**Technical**: Track token counts from Claude Code's output (it reports usage). Store in electron-store or SQLite. Cost estimation uses published Anthropic pricing. Real-time updates via IPC events.

### 2. Session Resume

Completed and stopped agent sessions can be resumed — the agent picks up where it left off with full conversation history.

**In Focused view**: Completed tabs show a "Resume" button in the info bar instead of the message input:
```
┌─ Info Bar ──────────────────────────────────────────────────────┐
│ ✓ Completed · Add --json output flag · 19.5k tokens · 8m ago   │
│                                                 [Resume Session]│
└─────────────────────────────────────────────────────────────────┘
```

**In Grid view**: Completed agent rows in the "Completed" section have a resume icon:
```
○ cli-tool / Coder · "Add --json output flag" · 15m ago   [↻ Resume]
```

**How it works**:
- Each agent session gets a persistent `sessionId` stored alongside the agent metadata
- Claude Code supports `--resume` with a session ID to continue a previous conversation
- When resumed, the agent's terminal shows the previous conversation history above the cursor
- The tab transitions from "completed" (gray dot) back to "working" (green dot)
- Token count continues from where it left off

**Session browser** (future): A searchable list of all past sessions, filterable by repo, role, date, and keyword. Accessible from Cmd+K ("sessions") or a dedicated section in the Agents view.

### 3. Output Filtering

A filter bar that can be toggled open to search/filter the agent's terminal output. Essential when agents produce verbose output.

**Activation**: Click the filter icon in the info bar, or press `Cmd+F` while an agent tab is focused.

```
┌─ Filter Bar ────────────────────────────────────────────────────┐
│ 🔍 [filter pattern...          ] [Text ▾] [Include ▾]  [✕]    │
└─────────────────────────────────────────────────────────────────┘
```

**Filter modes**:
- **Include**: Only show lines matching the pattern (highlight matches)
- **Exclude**: Hide lines matching the pattern (useful for filtering out noise)

**Match modes**:
- **Text**: Case-insensitive substring match
- **Regex**: Full regex pattern support

**Presets** (dropdown or quick buttons):
- "Errors only" — filter to lines containing error, Error, ERR, fail, FAIL
- "Tool use only" — show only tool call blocks (Read, Write, Bash, etc.)
- "Agent messages only" — hide tool output, show only agent reasoning
- "Hide tool output" — inverse of above

**Visual treatment**: When a filter is active, the filter bar stays visible with a colored indicator. Non-matching content is hidden (not just dimmed) to reduce noise. A count shows "Showing 12 of 47 messages."

### 4. Prevent Sleep

macOS power assertion to prevent the system from sleeping while any agent is actively working.

**Behavior**:
- When at least one agent has status `working` or `thinking`, assert `PreventUserIdleSystemSleep`
- When all agents are `completed`, `waiting`, `error`, or `idle`, release the assertion
- A subtle indicator in the header shows when sleep prevention is active:
  ```
  Agents  ● 2 working  ☕ Preventing sleep
  ```
- Configurable in Settings: "Prevent sleep while agents are working" (default: on)

**Technical**: Use Electron's `powerSaveBlocker.start('prevent-app-suspension')`. Track active agent count. Start blocker when count goes from 0→1, stop when count goes from 1→0.

### 5. Desktop Notifications

System notifications for agent lifecycle events, so you can switch away from RepoHub and still know when agents need attention.

**Notification triggers**:
- Agent finished (completed successfully)
- Agent errored (stopped with an error)
- Agent waiting for input (needs your response)
- Context threshold reached (yellow or red warning)

**Notification content**:
```
┌──────────────────────────────────────┐
│ 🟢 Agent Completed                   │
│ my-api / Coder finished:             │
│ "Add rate limiting to all endpoints" │
│ 18.2k tokens · 4 min                │
└──────────────────────────────────────┘
```

Clicking the notification focuses RepoHub and navigates to the relevant agent tab.

**Custom notification commands** (configurable in Settings):
- macOS TTS: `say "Agent finished"`
- Sound: `afplay /System/Library/Sounds/Glass.aiff`
- Custom: any shell command (receives agent info as env vars)
- Chaining: pipe multiple commands together

**Settings**:
```
Notifications:
  ☑ Agent completed
  ☑ Agent error
  ☑ Agent waiting for input
  ☐ Context warning (yellow)
  ☑ Context warning (red)

  Custom command: [say "Agent {agent_repo} {agent_status}"    ]
```

**Technical**: Use Electron's `Notification` API for desktop notifications. Custom commands via `child_process.exec` with env vars: `AGENT_REPO`, `AGENT_ROLE`, `AGENT_STATUS`, `AGENT_TASK`.

### 6. Git Worktree Isolation

When launching an agent, optionally create a dedicated git worktree so the agent works on an isolated branch without touching the main working directory. Prevents conflicts when multiple agents (or an agent and the user) work on the same repo.

**In the launch form** (advanced options):
```
Advanced:
  ☑ Create git worktree for this agent
    Branch name: [agent/rate-limiting       ]
    Worktree directory: ~/repohub-worktrees/my-api/rate-limiting
```

**How it works**:
1. `git worktree add <path> -b <branch>` creates an isolated copy on a new branch
2. The agent's PTY `cwd` is set to the worktree path instead of the main repo
3. The agent tab shows a branch icon indicating it's in a worktree: `● my-api 💻 🌿 agent/rate-limiting`
4. When the agent completes, offer options:
   - "Create PR" — push the branch and open a PR
   - "Merge to main" — merge the worktree branch back
   - "Keep worktree" — leave it for manual review
   - "Discard" — `git worktree remove` + delete the branch

**Nested display in tab/grid**:
If a repo has multiple agents in worktrees, they can be visually grouped:
```
[● my-api 💻 ✕] [  🌿 rate-limiting ✕] [  🌿 error-handling ✕]
```

**Benefits**:
- Two agents can both modify the same repo without merge conflicts
- The user's working directory stays clean — no surprise changes while you're editing
- Each agent's changes are on a named branch, easy to review as a PR
- Worktrees are cheap (shared `.git` directory, separate working tree)

**Settings**:
```
Git Worktrees:
  Default worktree directory: [~/repohub-worktrees              ]
  ☑ Auto-create worktree for Coder/Architect roles
  ☐ Auto-create worktree for all roles
  ☑ Clean up worktrees after merge/discard
```

### 7. Export Conversations

Export an agent's conversation for sharing, documentation, or archival.

**Export formats**:
- **HTML**: Self-contained file with RepoHub's palenight theme. Includes all messages, tool use, and agent info. Opens in any browser. Good for sharing with teammates who don't use RepoHub.
- **Markdown**: Plain text with code blocks. Good for pasting into docs, PRs, or issues.
- **GitHub Gist**: Publish directly as a secret or public gist via `gh` CLI. Returns a shareable URL.
- **JSON**: Raw structured data. Good for programmatic analysis.

**Access**: Menu in the info bar (Focused view) or right-click on a tile/completed row (Grid view).

**Export includes**:
- Agent metadata (repo, role, task, duration, token count)
- Full conversation with tool use details
- Optionally: files changed list with diffs

### 8. Automatic Tab Naming

After an agent processes its first message exchange, automatically generate a short descriptive name for the tab.

**Current**: Tab shows repo name (`my-api`). If you have two agents on the same repo, they're both `my-api`.

**With auto-naming**: After the first response, a fast model call (Haiku) generates a 2–5 word name:
```
Before: [● my-api 💻 ✕] [● my-api 🛡 ✕]
After:  [● Rate Limiting 💻 ✕] [● Security Audit 🛡 ✕]
```

**Fallback**: If no task was provided (interactive session), the name stays as the repo name until enough context exists to generate one.

**Manual override**: Double-click the tab name to rename it.

### 9. File Diff View

A panel or tab within an agent's terminal area that shows what files the agent has changed, with syntax-highlighted diffs.

**Access**: A "Changes" pill/tab in the agent info bar that shows a count:
```
[Terminal] [Changes (3)]
```

**Diff view**:
```
┌─ Changes ─────────────────────────────────────────────────────┐
│                                                                │
│  src/middleware/rateLimiter.ts (new file)                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ + import rateLimit from 'express-rate-limit'           │    │
│  │ +                                                      │    │
│  │ + export const apiLimiter = rateLimit({                │    │
│  │ +   windowMs: 15 * 60 * 1000,                         │    │
│  │ +   max: 100,                                         │    │
│  │ + })                                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  src/routes/api.ts (+12 -2)                                    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │   import { Router } from 'express'                     │    │
│  │ + import { apiLimiter, authLimiter } from '../mid...   │    │
│  │                                                        │    │
│  │   const router = Router()                              │    │
│  │ + router.use(apiLimiter)                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  package.json (+1 -0)                                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ + "express-rate-limit": "^7.1.0",                      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  [Accept All] [Revert All] [Create PR]                         │
└────────────────────────────────────────────────────────────────┘
```

**Technical**: Run `git diff` in the agent's working directory (or worktree). Parse the output for display. For worktree agents, diff against the base branch. Update after each tool:Write event.

**Actions**:
- Accept All — commit the changes (with generated message)
- Revert All — `git checkout .` to discard everything
- Revert File — discard individual file changes
- Create PR — commit, push, and open a PR (especially useful for worktree agents)

### 10. Context Compaction Button

A "Compact & Continue" button that appears when context usage reaches the red threshold. Summarizes the conversation to free up tokens so the agent can keep working.

See the [Context Management proposal](./context-management.md) for the full interactive block viewer and smart compaction system. This is the minimal version: a single button that triggers multi-pass compression.

**Behavior**:
1. Context hits 80%+ → yellow warning in the budget bar + notification
2. A "Compact" button appears in the info bar
3. Clicking it triggers a summarization pass (using the agent itself or a separate fast model)
4. Verbose tool outputs are collapsed, early conversation summarized, recent context preserved
5. Context drops back to ~40-50%
6. Agent resumes where it left off with compressed context

### 11. Group Chat / Moderator (Future)

A meta-agent that coordinates multiple agents working on related tasks. Inspired by Maestro's group chat pattern.

**How it would work**:
- Create a "Group" that contains multiple agents
- A moderator AI (separate from the worker agents) routes messages and synthesizes results
- Use `@mentions` to direct messages to specific agents: "@api-coder add the endpoint, @frontend-coder add the form"
- The moderator can answer questions by consulting multiple agents and merging their responses

**Deferred to Phase 4** — requires significant orchestration infrastructure and the Agent Command Center + Context Management to be solid first.

### 12. Playbooks / Auto Run (Future)

Markdown-based task automation: write a checklist of tasks, and agents process them sequentially with each task getting a fresh session.

```markdown
# Deploy Preparation Playbook

- [ ] Run full test suite and fix any failures
- [ ] Update CHANGELOG.md with recent changes
- [ ] Bump version in package.json
- [ ] Review and update README if needed
- [ ] Run security audit on dependencies
```

Each checkbox becomes an agent task. Fresh session per task prevents context bleed. Results logged per-task. The playbook can be saved and reused.

**Deferred to Phase 4** — depends on reliable session creation and management being rock-solid.

### 13. Execution Queue (Future)

Sequential queuing for write operations across agents working on the same repo. Read-only operations (Researcher, Reviewer) can run in parallel, but write operations (Coder, Architect) queue to prevent conflicts.

**Deferred to Phase 4** — an alternative/complement to git worktree isolation. Worktrees provide physical isolation; the execution queue provides logical isolation.

### 14. Conductor Profile (Future)

A short personal profile injected into every agent's system prompt so agents understand your background and preferences.

```
Settings → Agent Profile:
  "Senior full-stack engineer. TypeScript/React/Node stack.
   Prefers functional patterns. Hates classes. Always use
   pnpm. Format with prettier. Test with vitest."
```

This gets prepended to every agent's role prompt. Agents tailor their code style, explanations, and tool choices to match.

**Simple to implement** — just a text field in Settings that gets injected into the agent spawn command. But lower priority than the operational features above.

## Technical Approach

### New Services

**StatsService** — Tracks token usage and cost per agent session.
```typescript
class StatsService extends EventEmitter {
  recordUsage(agentId: string, tokens: { input: number; output: number; cache?: number }): void
  getSessionStats(agentId: string): SessionStats
  getAggregateStats(period: 'day' | 'week' | 'month'): AggregateStats
  getCostEstimate(tokens: number, model: string): number
}
```

**NotificationService** — Manages desktop notifications and custom commands.
```typescript
class NotificationService {
  notify(event: AgentEvent): void
  setCustomCommand(command: string): void
  getSettings(): NotificationSettings
}
```

**WorktreeService** — Manages git worktrees for agent isolation.
```typescript
class WorktreeService {
  createWorktree(repoPath: string, branchName: string): Promise<string>  // returns worktree path
  removeWorktree(worktreePath: string, deleteBranch: boolean): Promise<void>
  listWorktrees(repoPath: string): Promise<WorktreeInfo[]>
  getWorktreeDiff(worktreePath: string): Promise<FileDiff[]>
}
```

### New IPC Channels

- `agent:get-stats`, `agent:get-aggregate-stats` — Token/cost tracking
- `agent:resume-session` — Resume a completed session
- `agent:export` — Export conversation in specified format
- `agent:set-filter` — Apply output filter
- `agent:get-diff` — Get file changes for an agent
- `worktree:create`, `worktree:remove`, `worktree:list`, `worktree:diff`
- `notifications:configure`, `notifications:test`
- Events: `agent:stats-updated`, `agent:notification`

### Settings Additions

```typescript
interface AgentSettings {
  // Cost tracking
  showTokenCounts: boolean          // default: true
  showCostEstimates: boolean        // default: true

  // Sleep prevention
  preventSleepWhileWorking: boolean // default: true

  // Notifications
  notifyOnComplete: boolean         // default: true
  notifyOnError: boolean            // default: true
  notifyOnWaiting: boolean          // default: true
  notifyOnContextWarning: boolean   // default: false (red only)
  customNotificationCommand: string // default: ''

  // Git worktrees
  worktreeBaseDir: string           // default: ~/repohub-worktrees
  autoWorktreeForCoders: boolean    // default: false
  cleanupWorktreesOnMerge: boolean  // default: true

  // Tab naming
  autoNameTabs: boolean             // default: true

  // Conductor profile
  conductorProfile: string          // default: ''
}
```

## Scope

- **Phase 1** (ship with Agent Command Center):
  - Token/cost display in info bar and header
  - Prevent sleep while agents work
  - Desktop notifications (complete, error, waiting)
  - Session resume for completed agents

- **Phase 2** (fast follow):
  - Output filtering (text + regex, include/exclude)
  - Automatic tab naming
  - Export conversations (HTML + Markdown)
  - Conductor profile in Settings

- **Phase 3** (mature):
  - Git worktree isolation with launch form integration
  - File diff view with accept/revert/PR actions
  - Context compaction button
  - Full stats page with trends and breakdowns
  - Custom notification commands

- **Phase 4** (future):
  - Group chat / moderator
  - Playbooks / Auto Run
  - Execution queue
  - Session browser with search across all history

## References

- **Maestro** (`_reference/Maestro/`): Primary inspiration for most features. Maestro's SQLite-backed stats, power management, notification commands, worktree integration, output filtering, Auto Run, group chat, and conductor profile are all battle-tested in production.
- **Agent Command Center proposal**: These features augment the base Agent Command Center. The launch form, tab strip, terminal view, and agent lifecycle are defined there.
- **Context Management proposal**: Context compaction, the budget bar, and block viewer are detailed there. This proposal covers the simpler "Compact & Continue" button as a minimal version.
