import { readdir, readFile, stat, open as fsOpen } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';
import type {
  ClaudeProject,
  ClaudeSessionSummary,
  AgentMessage,
  AgentMessageType,
} from '../types/agent.types';

/**
 * Reads Claude Code's native JSONL session files from ~/.claude/projects/.
 * This lets us see ALL Claude sessions for a repo — including ones run from terminal.
 *
 * Performance: summaries are cached by filepath+mtime, and only the first/last
 * chunks of each file are read (not the full content) for summary extraction.
 */
export class ClaudeSessionReader {
  private claudeDir = join(homedir(), '.claude', 'projects');

  /** Cache: key = "filepath:mtimeMs", value = parsed summary */
  private summaryCache = new Map<string, ClaudeSessionSummary>();

  /** Cache for project list — invalidated on each listAllProjects call by checking dir mtime */
  private projectCache: { projects: ClaudeProject[]; dirMtimeMs: number } | null = null;

  /** Encode project path the same way Claude CLI does: replace / and . with - */
  encodeProjectPath(projectPath: string): string {
    return projectPath.replace(/[/.]/g, '-');
  }

  /** Best-guess decode: replace all - with / (ambiguous for paths with hyphens or dots) */
  decodeProjectPath(encoded: string): string {
    return encoded.replace(/-/g, '/');
  }

  /** Check if a string is an already-encoded path (starts with -) */
  private isEncodedPath(pathOrEncoded: string): boolean {
    return pathOrEncoded.startsWith('-');
  }

  /** List all Claude projects from ~/.claude/projects/ */
  async listAllProjects(): Promise<ClaudeProject[]> {
    // Check if parent dir mtime changed — if not, return cached list
    try {
      const dirStat = await stat(this.claudeDir);
      if (this.projectCache && this.projectCache.dirMtimeMs === dirStat.mtimeMs) {
        return this.projectCache.projects;
      }
    } catch {
      return [];
    }

    let entries: import('fs').Dirent[];
    try {
      entries = await readdir(this.claudeDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const dirs = entries.filter(e => e.isDirectory());

    const projects = await Promise.all(
      dirs.map(async (d): Promise<ClaudeProject | null> => {
        const encodedPath = d.name;
        const decodedPath = this.decodeProjectPath(encodedPath);
        const dirPath = join(this.claudeDir, encodedPath);

        let isValidPath = false;
        try {
          const s = await stat(decodedPath);
          isValidPath = s.isDirectory();
        } catch {
          isValidPath = false;
        }

        // Count .jsonl session files and get dir mtime
        let sessionCount = 0;
        let lastActiveAt: Date;
        try {
          const ds = await stat(dirPath);
          lastActiveAt = ds.mtime;
          const files = await readdir(dirPath);
          sessionCount = files.filter(f => f.endsWith('.jsonl')).length;
        } catch {
          return null;
        }

        if (sessionCount === 0) return null;

        const segments = decodedPath.split('/').filter(Boolean);
        const displayName = segments[segments.length - 1] || encodedPath;

        return {
          encodedPath,
          decodedPath,
          isValidPath,
          displayName,
          sessionCount,
          lastActiveAt: lastActiveAt.toISOString(),
        };
      }),
    );

    const result = projects
      .filter((p): p is ClaudeProject => p !== null)
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
      .slice(0, 100);

    // Update cache
    try {
      const dirStat = await stat(this.claudeDir);
      this.projectCache = { projects: result, dirMtimeMs: dirStat.mtimeMs };
    } catch {
      // ignore
    }

    return result;
  }

  /** List ALL sessions across ALL projects, sorted by modifiedAt desc. Cap at 200.
   *  Each session includes project info fields.
   */
  async listAllSessions(): Promise<ClaudeSessionSummary[]> {
    const projects = await this.listAllProjects();

    const allSessions = await Promise.all(
      projects.map(async project => {
        const sessions = await this.listSessions(project.encodedPath);
        return sessions.map(s => ({
          ...s,
          projectEncodedPath: project.encodedPath,
          projectDisplayName: project.displayName,
          projectDecodedPath: project.decodedPath,
          projectIsValidPath: project.isValidPath,
        }));
      }),
    );

    return allSessions
      .flat()
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, 200);
  }

  /** List recent sessions for a project, sorted by modified date desc. Cap at 50.
   *  Accepts either a filesystem path (will be encoded) or an already-encoded path (starts with -).
   */
  async listSessions(projectPath: string): Promise<ClaudeSessionSummary[]> {
    const encoded = this.isEncodedPath(projectPath)
      ? projectPath
      : this.encodeProjectPath(projectPath);
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
          return { file: f, path: fp, mtime: s.mtime, birthtime: s.birthtime, size: s.size };
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
      valid.map(async ({ file, path: fp, mtime, birthtime, size }) => {
        try {
          return await this.parseSessionSummary(
            file.replace('.jsonl', ''),
            fp,
            birthtime,
            mtime,
            size,
          );
        } catch {
          return null;
        }
      }),
    );

    return summaries.filter((s): s is ClaudeSessionSummary => s !== null);
  }

  /** Read full session messages, converted to our AgentMessage format.
   *  Accepts either a filesystem path or an already-encoded path (starts with -).
   */
  async readSessionMessages(projectPath: string, sessionId: string): Promise<AgentMessage[]> {
    // Validate sessionId to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return [];
    }

    const encoded = this.isEncodedPath(projectPath)
      ? projectPath
      : this.encodeProjectPath(projectPath);
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

  /**
   * Stream the file line-by-line from the start to find the first real user text.
   * Stops reading as soon as it finds one (fast for most files where it's line 2-3).
   * Falls back to scanning up to 500 lines for sessions that start with slash commands.
   */
  private streamFirstUserText(
    filePath: string,
  ): Promise<{ text: string; messageCount: number; hasAssistant: boolean }> {
    return new Promise(resolve => {
      let text = '';
      let messageCount = 0;
      let hasAssistant = false;
      let linesRead = 0;

      const rl = createInterface({
        input: createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      rl.on('line', line => {
        if (!line.trim()) return;
        linesRead++;
        if (linesRead > 500) {
          rl.close();
          return;
        }

        let obj: any;
        try {
          obj = JSON.parse(line);
        } catch {
          return;
        }

        if (obj.type === 'user' || obj.type === 'assistant') messageCount++;
        if (obj.type === 'assistant') hasAssistant = true;
        if (obj.type === 'user' && !text) {
          const extracted = this.extractUserText(obj);
          if (extracted) {
            text = extracted;
            // Found real text — stop reading
            rl.close();
          }
        }
      });

      rl.on('close', () => resolve({ text, messageCount, hasAssistant }));
      rl.on('error', () => resolve({ text, messageCount, hasAssistant }));
    });
  }

  private async parseSessionSummary(
    sessionId: string,
    filePath: string,
    birthtime: Date,
    mtime: Date,
    fileSize: number,
  ): Promise<ClaudeSessionSummary | null> {
    // Check cache — keyed on filepath + mtime
    const cacheKey = `${filePath}:${mtime.getTime()}`;
    const cached = this.summaryCache.get(cacheKey);
    if (cached) return cached;

    // Stream from start to find first real user text (stops early)
    const { text: firstUserText, messageCount, hasAssistant } =
      await this.streamFirstUserText(filePath);

    // Read last 4KB for cost (result line is always at the end)
    let costUsd = 0;
    let tailHasAssistant = hasAssistant;
    const TAIL_SIZE = 4 * 1024;
    if (fileSize > TAIL_SIZE) {
      const fh = await fsOpen(filePath, 'r');
      try {
        const buf = Buffer.alloc(TAIL_SIZE);
        await fh.read(buf, 0, TAIL_SIZE, fileSize - TAIL_SIZE);
        const tailLines = buf.toString('utf-8').split('\n').filter(l => l.trim());
        tailLines.shift(); // drop first (likely truncated)
        for (let i = tailLines.length - 1; i >= 0; i--) {
          try {
            const obj = JSON.parse(tailLines[i]);
            if (obj.type === 'result' && obj.total_cost_usd !== undefined) {
              costUsd = obj.total_cost_usd;
              break;
            }
            if (obj.type === 'assistant') tailHasAssistant = true;
          } catch {
            continue;
          }
        }
      } finally {
        await fh.close();
      }
    }

    // Stub sessions: no real text AND no assistant response (just slash commands)
    if (!firstUserText && !tailHasAssistant) return null;

    const durationSeconds = Math.max(0, Math.floor((mtime.getTime() - birthtime.getTime()) / 1000));
    const fallbackTask = `Session from ${birthtime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const summary: ClaudeSessionSummary = {
      sessionId,
      task: firstUserText || fallbackTask,
      messageCount,
      costUsd,
      startedAt: birthtime.toISOString(),
      modifiedAt: mtime.toISOString(),
      durationSeconds,
    };

    this.summaryCache.set(cacheKey, summary);
    return summary;
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

  /** Strings that Claude Code injects as user messages but aren't real tasks */
  private static NOISE_PATTERNS = [
    /^\[Request interrupted by user/,
    /^\[User stopped generation/,
    /^\[Conversation resumed/,
    /^\[Previous response was interrupted/,
  ];

  private isNoiseText(text: string): boolean {
    return ClaudeSessionReader.NOISE_PATTERNS.some(p => p.test(text));
  }

  private extractUserText(obj: any): string {
    const msg = obj.message;
    if (!msg) return '';

    const content = msg.content;
    if (typeof content === 'string') {
      const cleaned = this.stripSystemXml(content);
      if (cleaned && !this.isNoiseText(cleaned)) return cleaned.slice(0, 200);
      return '';
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          const cleaned = this.stripSystemXml(block.text);
          if (cleaned && !this.isNoiseText(cleaned)) return cleaned.slice(0, 200);
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
