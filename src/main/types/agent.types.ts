export type AgentState =
  | 'starting'
  | 'connected'
  | 'working'
  | 'idle'
  | 'stopping'
  | 'waiting_permission'
  | 'error'
  | 'completed';

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface AgentRole {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  defaultPermissionMode: PermissionMode;
}

export const BUILT_IN_ROLES: AgentRole[] = [
  {
    id: 'coder',
    name: 'Coder',
    icon: 'Code',
    description: 'Full-featured coding agent. Reads, writes, and executes code.',
    systemPrompt:
      'You are a coding agent. Write clean, well-structured code. Follow existing project conventions. Test your changes when possible.',
    defaultPermissionMode: 'default',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    icon: 'Eye',
    description:
      'Read-only code reviewer. Analyzes code quality, finds bugs, suggests improvements.',
    systemPrompt:
      'You are a code review agent. Analyze the codebase for bugs, security issues, code quality problems, and suggest improvements. Do NOT modify any files — only read and analyze.',
    defaultPermissionMode: 'plan',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    icon: 'Search',
    description:
      'Read-only research agent. Explores codebases, answers questions, maps architecture.',
    systemPrompt:
      'You are a research agent. Explore the codebase to answer questions, map architecture, and explain how things work. Do NOT modify any files — only read and analyze.',
    defaultPermissionMode: 'plan',
  },
];

export interface AgentLaunchConfig {
  repoId: string;
  repoPath: string;
  repoName: string;
  roleId: string;
  task: string;
  autonomous: boolean;
}

export interface AgentSession {
  id: string;
  config: AgentLaunchConfig;
  state: AgentState;
  pid?: number;
  cliSessionId?: string;
  messages: AgentMessage[];
  cost: { inputTokens: number; outputTokens: number; totalCost: number };
  startedAt: number;
  completedAt?: number;
}

export type AgentMessageType =
  | 'user'
  | 'assistant_text'
  | 'tool_use'
  | 'tool_result'
  | 'system'
  | 'error'
  | 'result';

export interface AgentMessage {
  id: string;
  type: AgentMessageType;
  timestamp: number;
  content: string;
  toolName?: string;
  toolInput?: string;
  isCollapsed?: boolean;
}

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  input: string;
  description: string;
}

// Serializable version sent over IPC (no Map/Set)
export interface AgentSessionInfo {
  id: string;
  config: AgentLaunchConfig;
  state: AgentState;
  pid?: number;
  cliSessionId?: string;
  cost: { inputTokens: number; outputTokens: number; totalCost: number };
  startedAt: number;
  completedAt?: number;
  messageCount: number;
}

// Summary of a Claude CLI session read from ~/.claude/projects/
export interface ClaudeSessionSummary {
  sessionId: string;
  task: string;
  messageCount: number;
  costUsd: number;
  startedAt: string;
  modifiedAt: string;
  durationSeconds: number;
}
