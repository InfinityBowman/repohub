import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { ClaudeSessionSummary, AgentMessage, AgentMessageType } from '../types/agent.types';

/**
 * Reads Claude Code's native JSONL session files from ~/.claude/projects/.
 * This lets us see ALL Claude sessions for a repo — including ones run from terminal.
 */
export class ClaudeSessionReader {
  private claudeDir = join(homedir(), '.claude', 'projects');

  /** Encode project path the same way Claude CLI does: replace / and . with - */
  encodeProjectPath(projectPath: string): string {
    return projectPath.replace(/[/.]/g, '-');
  }

  /** List recent sessions for a project, sorted by modified date desc. Cap at 50. */
  async listSessions(projectPath: string): Promise<ClaudeSessionSummary[]> {
    const encoded = this.encodeProjectPath(projectPath);
    const dir = join(this.claudeDir, encoded);

    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return []; // Directory doesn't exist — no sessions
    }

    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    // Get file stats and sort by mtime desc
    const withStats = await Promise.all(
      jsonlFiles.map(async f => {
        const fp = join(dir, f);
        try {
          const s = await stat(fp);
          return { file: f, path: fp, mtime: s.mtime, birthtime: s.birthtime };
        } catch {
          return null;
        }
      }),
    );

    const valid = withStats
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, 50);

    // Parse each file for summary info
    const summaries = await Promise.all(
      valid.map(async ({ file, path: fp, mtime, birthtime }) => {
        try {
          return await this.parseSessionSummary(file.replace('.jsonl', ''), fp, birthtime, mtime);
        } catch {
          return null;
        }
      }),
    );

    return summaries.filter((s): s is ClaudeSessionSummary => s !== null);
  }

  /** Read full session messages, converted to our AgentMessage format. */
  async readSessionMessages(projectPath: string, sessionId: string): Promise<AgentMessage[]> {
    // Validate sessionId to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return [];
    }

    const encoded = this.encodeProjectPath(projectPath);
    const fp = join(this.claudeDir, encoded, `${sessionId}.jsonl`);

    let content: string;
    try {
      content = await readFile(fp, 'utf-8');
    } catch {
      return [];
    }

    const messages: AgentMessage[] = [];
    let counter = 0;

    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      const parsed = this.parseLineToMessages(obj, counter);
      for (const msg of parsed) {
        messages.push(msg);
        counter++;
      }
    }

    return messages;
  }

  // --- Private helpers ---

  private async parseSessionSummary(
    sessionId: string,
    filePath: string,
    birthtime: Date,
    mtime: Date,
  ): Promise<ClaudeSessionSummary | null> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let firstUserText = '';
    let messageCount = 0;
    let costUsd = 0;

    for (const line of lines) {
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      const type = obj.type;

      // Count meaningful messages (not progress, file-history-snapshot, etc.)
      if (type === 'user' || type === 'assistant') {
        messageCount++;
      }

      // Extract first user text as task preview
      if (type === 'user' && !firstUserText) {
        firstUserText = this.extractUserText(obj);
      }

      // Extract cost from result
      if (type === 'result' && obj.total_cost_usd !== undefined) {
        costUsd = obj.total_cost_usd;
      }
    }

    if (!firstUserText && messageCount === 0) return null;

    const durationSeconds = Math.max(0, Math.floor((mtime.getTime() - birthtime.getTime()) / 1000));

    return {
      sessionId,
      task: firstUserText || '(no task text)',
      messageCount,
      costUsd,
      startedAt: birthtime.toISOString(),
      modifiedAt: mtime.toISOString(),
      durationSeconds,
    };
  }

  /** Strip Claude Code system-injected XML blocks (tags + their content) then remaining tags. */
  private stripSystemXml(text: string): string {
    // First, remove known system blocks entirely (tag + content + closing tag)
    const systemTags = [
      'system-reminder',
      'local-command-caveat',
      'command-name',
      'command-message',
      'command-args',
      'local-command-stdout',
      'fast_mode_info',
    ];
    let cleaned = text;
    for (const tag of systemTags) {
      // Match <tag>...</tag> including newlines (dotAll via [\s\S])
      cleaned = cleaned.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g'), '');
    }
    // Strip any remaining XML-like tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    return cleaned.trim();
  }

  private extractUserText(obj: any): string {
    const msg = obj.message;
    if (!msg) return '';

    const content = msg.content;
    if (typeof content === 'string') {
      const cleaned = this.stripSystemXml(content);
      return cleaned.slice(0, 200);
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          const cleaned = this.stripSystemXml(block.text);
          if (cleaned) return cleaned.slice(0, 200);
        }
      }
    }

    return '';
  }

  private parseLineToMessages(obj: any, baseCounter: number): AgentMessage[] {
    const messages: AgentMessage[] = [];
    const type = obj.type;

    const makeMsg = (
      msgType: AgentMessageType,
      content: string,
      extra?: { toolName?: string; toolInput?: string },
    ): AgentMessage => ({
      id: `hist-${baseCounter + messages.length}`,
      type: msgType,
      timestamp: obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now(),
      content,
      ...extra,
    });

    switch (type) {
      case 'system': {
        const model = obj.model || 'unknown';
        messages.push(makeMsg('system', `Session started (model: ${model})`));
        break;
      }

      case 'user': {
        const content = obj.message?.content;
        if (typeof content === 'string') {
          const cleaned = this.stripSystemXml(content);
          if (cleaned) {
            messages.push(makeMsg('user', cleaned));
          }
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text?.trim()) {
              const cleaned = this.stripSystemXml(block.text);
              if (cleaned) messages.push(makeMsg('user', cleaned));
            } else if (block.type === 'tool_result') {
              const text =
                typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
              const truncated =
                text.length > 2000 ? text.slice(0, 2000) + '\n... (truncated)' : text;
              messages.push(makeMsg('tool_result', truncated, { toolName: block.tool_use_id }));
            }
          }
        }
        break;
      }

      case 'assistant': {
        const content = obj.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text?.trim()) {
              messages.push(makeMsg('assistant_text', block.text));
            } else if (block.type === 'thinking' && block.thinking?.trim()) {
              messages.push(makeMsg('thinking', block.thinking));
            } else if (block.type === 'tool_use') {
              messages.push(
                makeMsg('tool_use', block.name || 'Tool', {
                  toolName: block.name,
                  toolInput: block.input ? JSON.stringify(block.input, null, 2) : undefined,
                }),
              );
            }
          }
        }
        break;
      }

      case 'result': {
        const cost = obj.total_cost_usd ?? 0;
        const turns = obj.num_turns ?? 0;
        messages.push(makeMsg('result', `Completed (${turns} turns, $${cost.toFixed(4)})`));
        break;
      }

      // Skip file-history-snapshot, progress, stream_event — not useful for history view
    }

    return messages;
  }
}
