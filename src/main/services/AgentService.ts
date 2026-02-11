import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type {
  AgentLaunchConfig,
  AgentSession,
  AgentMessage,
  AgentMessageType,
  AgentSessionInfo,
  PermissionRequest,
  PermissionMode,
} from '../types/agent.types';
import { BUILT_IN_ROLES } from '../types/agent.types';

export class AgentService extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private processes = new Map<string, ChildProcess>();
  private stdoutBuffers = new Map<string, string>();
  private messageCounter = 0;

  async launchAgent(config: AgentLaunchConfig): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();
    const role = BUILT_IN_ROLES.find(r => r.id === config.roleId);
    if (!role) throw new Error(`Unknown role: ${config.roleId}`);

    const permissionMode = this.resolvePermissionMode(config);

    const session: AgentSession = {
      id: sessionId,
      config,
      state: 'starting',
      messages: [],
      pendingPermissions: [],
      cost: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
      startedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.stdoutBuffers.set(sessionId, '');

    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', permissionMode,
      '--system-prompt', role.systemPrompt,
    ];

    try {
      const child = this.spawnAndAttach(sessionId, session, args);

      session.state = 'working';
      this.addMessage(sessionId, 'user', config.task);
      this.emit('agent:launched', this.toSessionInfo(session));

      // Send initial task via stdin NDJSON
      const initMsg = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: config.task },
        session_id: 'init',
        parent_tool_use_id: null,
      }) + '\n';
      child.stdin?.write(initMsg);

      return { sessionId };
    } catch (err: any) {
      session.state = 'error';
      this.addMessage(sessionId, 'error', err.message);
      this.emitStatusChanged(sessionId);
      throw err;
    }
  }

  async stopAgent(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const child = this.processes.get(sessionId);
    if (child) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (this.processes.has(sessionId)) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }

    session.state = 'completed';
    session.completedAt = Date.now();
    this.emitStatusChanged(sessionId);
  }

  async resumeSession(
    cliSessionId: string,
    config: AgentLaunchConfig,
  ): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();
    const role = BUILT_IN_ROLES.find(r => r.id === config.roleId);
    if (!role) throw new Error(`Unknown role: ${config.roleId}`);

    const permissionMode = this.resolvePermissionMode(config);

    const session: AgentSession = {
      id: sessionId,
      config,
      state: 'starting',
      messages: [],
      pendingPermissions: [],
      cost: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
      startedAt: Date.now(),
      cliSessionId,
    };

    this.sessions.set(sessionId, session);
    this.stdoutBuffers.set(sessionId, '');

    const args = [
      '--resume', cliSessionId,
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', permissionMode,
    ];

    try {
      this.spawnAndAttach(sessionId, session, args);

      session.state = 'working';
      this.addMessage(sessionId, 'system', `Resuming session ${cliSessionId.slice(0, 8)}...`);
      this.emit('agent:launched', this.toSessionInfo(session));

      return { sessionId };
    } catch (err: any) {
      session.state = 'error';
      this.addMessage(sessionId, 'error', err.message);
      this.emitStatusChanged(sessionId);
      throw err;
    }
  }

  sendMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const child = this.processes.get(sessionId);
    if (!child || !child.stdin?.writable) {
      throw new Error('Agent process is not running');
    }

    this.addMessage(sessionId, 'user', content);

    // stdin stream-json format: {"type":"user","message":{"role":"user","content":"..."},"session_id":"..."}
    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content },
      session_id: session.cliSessionId || 'default',
      parent_tool_use_id: null,
    }) + '\n';
    child.stdin.write(msg);

    session.state = 'working';
    this.emitStatusChanged(sessionId);
  }

  respondPermission(
    _sessionId: string,
    _requestId: string,
    _allow: boolean,
  ): void {
    // Permission handling in print mode uses --permission-mode flag at launch.
    // Interactive permission approval via stdin is not supported in basic stream-json mode.
    // For supervised mode, use --permission-mode acceptEdits (auto-approves edits).
    // For autonomous mode, use --permission-mode bypassPermissions.
  }

  getAllAgents(): AgentSessionInfo[] {
    return Array.from(this.sessions.values()).map(s => this.toSessionInfo(s));
  }

  getMessages(sessionId: string): AgentMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  getPendingPermissions(sessionId: string): PermissionRequest[] {
    const session = this.sessions.get(sessionId);
    return session ? session.pendingPermissions : [];
  }

  shutdown(): void {
    for (const [id, child] of this.processes) {
      child.kill('SIGKILL');
      this.processes.delete(id);
    }
    this.sessions.clear();
    this.stdoutBuffers.clear();
  }

  // --- Process management ---

  private spawnAndAttach(sessionId: string, session: AgentSession, args: string[]): ChildProcess {
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: session.config.repoPath,
      env: { ...process.env },
      detached: false,
    });

    session.pid = child.pid;
    this.processes.set(sessionId, child);

    child.stdout?.on('data', (data: Buffer) => {
      this.handleStdout(sessionId, data);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        console.warn(`[Agent ${sessionId.slice(0, 8)}] stderr:`, text);
      }
    });

    child.on('exit', (code, signal) => {
      this.processes.delete(sessionId);
      this.stdoutBuffers.delete(sessionId);
      const s = this.sessions.get(sessionId);
      if (s && s.state !== 'completed') {
        s.state = 'completed';
        s.completedAt = Date.now();
        this.emitStatusChanged(sessionId);
      }
    });

    child.on('error', err => {
      console.error(`[Agent ${sessionId.slice(0, 8)}] Spawn error:`, err.message);
      this.processes.delete(sessionId);
      const s = this.sessions.get(sessionId);
      if (s) {
        s.state = 'error';
        this.addMessage(sessionId, 'error', `Failed to start claude CLI: ${err.message}`);
        this.emitStatusChanged(sessionId);
      }
    });

    return child;
  }

  // --- stdout NDJSON parsing ---

  private handleStdout(sessionId: string, data: Buffer): void {
    const buffer = (this.stdoutBuffers.get(sessionId) || '') + data.toString();
    const lines = buffer.split('\n');
    this.stdoutBuffers.set(sessionId, lines.pop() || '');

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        this.routeCLIMessage(sessionId, msg);
      } catch {
        console.warn(`[Agent ${sessionId.slice(0, 8)}] Failed to parse:`, line.slice(0, 200));
      }
    }
  }

  private routeCLIMessage(sessionId: string, msg: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (msg.type) {
      // Session init: {"type":"system","session_id":"...","model":"...","tools":[...],...}
      case 'system': {
        session.cliSessionId = msg.session_id;
        const tools = msg.tools ? ` tools: ${msg.tools.join(', ')}` : '';
        this.addMessage(sessionId, 'system', `Connected (model: ${msg.model || 'unknown'}${tools})`);
        break;
      }

      // Complete assistant turn: {"type":"assistant","message":{"content":[...],"usage":{...}}}
      case 'assistant': {
        session.state = 'working';
        this.emitStatusChanged(sessionId);

        const content = msg.message?.content;
        if (content && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              // Clear streaming text since we now have the full message
              this.emit('agent:stream', { sessionId, delta: '' });
              this.addMessage(sessionId, 'assistant_text', block.text);
            } else if (block.type === 'tool_use') {
              this.addMessage(sessionId, 'tool_use', block.name, {
                toolName: block.name,
                toolInput: JSON.stringify(block.input, null, 2),
              });
            }
          }
        }

        // Track usage from assistant messages
        const usage = msg.message?.usage;
        if (usage) {
          session.cost.inputTokens += usage.input_tokens || 0;
          session.cost.outputTokens += usage.output_tokens || 0;
        }
        break;
      }

      // Tool results sent back: {"type":"user","message":{"content":[{"type":"tool_result",...}]}}
      case 'user': {
        const content = msg.message?.content;
        if (content && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              const text = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
              // Truncate long tool results for display
              const truncated = text.length > 2000 ? text.slice(0, 2000) + '\n... (truncated)' : text;
              this.addMessage(sessionId, 'tool_result', truncated, {
                toolName: block.tool_use_id,
              });
            }
          }
        }
        break;
      }

      // Streaming events: {"type":"stream_event","event":{"type":"content_block_delta","delta":{"text":"..."}}}
      case 'stream_event': {
        const event = msg.event;
        if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          this.emit('agent:stream', {
            sessionId,
            delta: event.delta.text,
          });
        }
        break;
      }

      // Final result: {"type":"result","subtype":"success","total_cost_usd":0.02,"usage":{...}}
      case 'result': {
        if (msg.total_cost_usd !== undefined) {
          session.cost.totalCost = msg.total_cost_usd;
        }
        if (msg.usage) {
          session.cost.inputTokens = msg.usage.input_tokens || session.cost.inputTokens;
          session.cost.outputTokens = msg.usage.output_tokens || session.cost.outputTokens;
        }

        const subtype = msg.subtype || 'unknown';
        if (msg.is_error || subtype.startsWith('error')) {
          this.addMessage(sessionId, 'error', `Agent finished with error: ${subtype}`);
        }

        if (msg.permission_denials?.length > 0) {
          const denied = msg.permission_denials
            .map((d: any) => d.tool_name || 'unknown')
            .join(', ');
          this.addMessage(sessionId, 'system', `Permission denied for: ${denied}`);
        }

        this.addMessage(sessionId, 'result',
          `Completed (${msg.num_turns || 0} turns, $${session.cost.totalCost.toFixed(4)})`);

        session.state = 'idle';
        this.emitStatusChanged(sessionId);
        this.emit('agent:result', {
          sessionId,
          cost: session.cost,
        });
        break;
      }

      default:
        break;
    }
  }

  private resolvePermissionMode(config: AgentLaunchConfig): PermissionMode {
    const role = BUILT_IN_ROLES.find(r => r.id === config.roleId);
    if (!role) return 'default';

    if (config.autonomous && role.id === 'coder') {
      return 'bypassPermissions';
    }
    // Supervised coder: acceptEdits allows file edits + safe bash commands
    if (role.id === 'coder') {
      return 'acceptEdits';
    }
    return role.defaultPermissionMode;
  }

  private addMessage(
    sessionId: string,
    type: AgentMessageType,
    content: string,
    extra?: { toolName?: string; toolInput?: string },
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message: AgentMessage = {
      id: `msg-${++this.messageCounter}`,
      type,
      timestamp: Date.now(),
      content,
      ...extra,
    };

    session.messages.push(message);

    this.emit('agent:output', {
      sessionId,
      message,
    });
  }

  private emitStatusChanged(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.emit('agent:status-changed', this.toSessionInfo(session));
  }

  private toSessionInfo(session: AgentSession): AgentSessionInfo {
    return {
      id: session.id,
      config: session.config,
      state: session.state,
      pid: session.pid,
      cliSessionId: session.cliSessionId,
      cost: { ...session.cost },
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      messageCount: session.messages.length,
      pendingPermissionCount: session.pendingPermissions.length,
    };
  }
}
