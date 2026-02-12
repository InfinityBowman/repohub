import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Wrench,
  AlertCircle,
  User,
  Bot,
  Info,
  CheckCircle,
  Copy,
  Check,
  Terminal,
  FileCode,
  FilePlus,
  Brain,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { CodeBlock } from '@/components/ui/code-block';
import { DiffViewer, NewContentViewer } from '@/components/ui/diff-viewer';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { AgentMessage } from '@/types';

// --- Helpers ---

/** Extract a short preview string from tool input JSON */
function getToolPreview(toolName?: string, toolInput?: string): string {
  if (!toolInput) return '';
  try {
    const parsed = JSON.parse(toolInput);
    switch (toolName) {
      case 'Bash':
        return parsed.command ? truncate(parsed.command, 80) : '';
      case 'Read':
      case 'Write':
      case 'Edit':
        return parsed.file_path ? truncate(parsed.file_path, 80) : '';
      case 'Grep':
        return parsed.pattern ? truncate(parsed.pattern, 60) : '';
      case 'Glob':
        return parsed.pattern ? truncate(parsed.pattern, 60) : '';
      case 'Task':
        return parsed.description ? truncate(parsed.description, 60) : '';
      case 'WebFetch':
        return parsed.url ? truncate(parsed.url, 80) : '';
      case 'WebSearch':
        return parsed.query ? truncate(parsed.query, 60) : '';
      default: {
        const firstVal = Object.values(parsed).find(v => typeof v === 'string');
        return firstVal ? truncate(String(firstVal), 60) : '';
      }
    }
  } catch {
    return truncate(toolInput, 60);
  }
}

function truncate(str: string, max: number): string {
  const line = str.split('\n')[0];
  return line.length > max ? line.slice(0, max) + '...' : line;
}

/** Get first non-empty line from tool result content */
function getResultPreview(content: string): string {
  const line = content
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0);
  return line ? truncate(line, 100) : '';
}

/** Map file extensions to syntax highlighting languages */
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  swift: 'swift',
  rb: 'ruby',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  xml: 'xml',
  sql: 'sql',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
};

/** Extract language from a file path's extension */
function langFromPath(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? EXT_TO_LANG[ext] || null : null;
}

/** Strip `cat -n` style line number prefixes (e.g. "  1→" or "  42→") */
function stripLineNumbers(content: string): string {
  return content.replace(/^ *\d+→/gm, '');
}

/** Guess language for syntax highlighting from content */
function guessLang(content: string, toolName?: string): string {
  if (toolName === 'Bash') return 'bash';
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'text';
}

// --- Copy Button ---

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className='text-muted-foreground hover:text-foreground bg-accent absolute top-2 right-2 z-10 rounded p-1 opacity-0 transition-all group-hover/code:opacity-100'
      title='Copy'
    >
      {copied ?
        <Check className='h-3.5 w-3.5 text-green-400' />
      : <Copy className='h-3.5 w-3.5' />}
    </button>
  );
}

/** Try to extract a short filename from a full path */
function shortPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : filePath;
}

/** Parse Edit tool input into structured data */
function parseEditInput(
  toolInput: string,
): { filePath: string; oldString: string; newString: string } | null {
  try {
    const parsed = JSON.parse(toolInput);
    if (
      parsed.file_path &&
      typeof parsed.old_string === 'string' &&
      typeof parsed.new_string === 'string'
    ) {
      return {
        filePath: parsed.file_path,
        oldString: parsed.old_string,
        newString: parsed.new_string,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Parse Write tool input into structured data */
function parseWriteInput(toolInput: string): { filePath: string; content: string } | null {
  try {
    const parsed = JSON.parse(toolInput);
    if (parsed.file_path && typeof parsed.content === 'string') {
      return { filePath: parsed.file_path, content: parsed.content };
    }
  } catch {
    /* ignore */
  }
  return null;
}

// --- Popover wrapper for tool content ---

const POPOVER_CLASSES =
  '!w-auto max-w-[calc(100vw-14rem-3rem)] !border-0 !bg-transparent !p-0 !shadow-none';

const POPOVER_CODE_CLASSES =
  'group/code relative min-w-0 max-h-80 overflow-auto [&_pre]:!max-h-none';

// --- Tool use + result grouping helper ---

interface MessageGroupSingle {
  type: 'single';
  messages: AgentMessage[];
}

interface MessageGroupToolPair {
  type: 'tool_pair';
  messages: AgentMessage[];
}

interface MessageGroupToolBatch {
  type: 'tool_batch';
  toolName: string;
  count: number;
  pairs: AgentMessage[][];
}

type MessageGroup = MessageGroupSingle | MessageGroupToolPair | MessageGroupToolBatch;

function groupMessages(messages: AgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    // Check for tool_use + tool_result pair
    if (
      msg.type === 'tool_use' &&
      i + 1 < messages.length &&
      messages[i + 1].type === 'tool_result'
    ) {
      const toolName = msg.toolName || '';
      const pairs: AgentMessage[][] = [[msg, messages[i + 1]]];
      i += 2;

      // Collect consecutive pairs with same tool name (skip if toolName is empty)
      while (
        toolName &&
        i + 1 < messages.length &&
        messages[i].type === 'tool_use' &&
        messages[i + 1].type === 'tool_result' &&
        messages[i].toolName === toolName
      ) {
        pairs.push([messages[i], messages[i + 1]]);
        i += 2;
      }

      // Batch if 3+, otherwise emit individual tool_pairs
      if (pairs.length >= 3) {
        groups.push({ type: 'tool_batch', toolName, count: pairs.length, pairs });
      } else {
        for (const pair of pairs) {
          groups.push({ type: 'tool_pair', messages: pair });
        }
      }
    } else {
      groups.push({ type: 'single', messages: [msg] });
      i++;
    }
  }

  return groups;
}

// --- Message Blocks ---

function UserMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-3 rounded-lg bg-purple-500/5 px-3 py-2.5'>
      <User className='mt-0.5 h-4 w-4 shrink-0 text-purple-400' />
      <div className='min-w-0 flex-1'>
        <span className='text-sm whitespace-pre-wrap text-purple-200/90'>{message.content}</span>
      </div>
    </div>
  );
}

function AssistantTextMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-3 py-2'>
      <Bot className='mt-0.5 h-4 w-4 shrink-0 text-blue-400' />
      <div className='min-w-0 flex-1 text-sm'>
        <MarkdownRenderer className='prose-xs'>{message.content}</MarkdownRenderer>
      </div>
    </div>
  );
}

function EditToolMessage({ message }: { message: AgentMessage }) {
  const editData = message.toolInput ? parseEditInput(message.toolInput) : null;
  if (!editData) return <GenericToolUseMessage message={message} />;

  return (
    <div className='space-y-1.5 py-1'>
      <div className='flex items-center gap-3'>
        <FileCode className='h-3.5 w-3.5 shrink-0 text-yellow-400/70' />
        <div className='flex min-w-0 items-center gap-2'>
          <span className='inline-flex shrink-0 items-center rounded-md bg-yellow-400/10 px-1.5 py-0.5 text-xs font-medium text-yellow-300'>
            Edit
          </span>
          <span className='text-muted-foreground truncate font-mono text-xs'>
            {shortPath(editData.filePath)}
          </span>
        </div>
      </div>
      <div className='ml-6'>
        <DiffViewer
          oldCode={editData.oldString}
          newCode={editData.newString}
          fileName={editData.filePath}
        />
      </div>
    </div>
  );
}

function WriteToolMessage({ message }: { message: AgentMessage }) {
  const writeData = message.toolInput ? parseWriteInput(message.toolInput) : null;
  if (!writeData) return <GenericToolUseMessage message={message} />;

  // Truncate very long write content for display
  const displayContent =
    writeData.content.length > 5000 ?
      writeData.content.slice(0, 5000) + '\n... (truncated)'
    : writeData.content;

  return (
    <div className='space-y-1.5 py-1'>
      <div className='flex items-center gap-3'>
        <FilePlus className='h-3.5 w-3.5 shrink-0 text-green-400/70' />
        <div className='flex min-w-0 items-center gap-2'>
          <span className='inline-flex shrink-0 items-center rounded-md bg-green-400/10 px-1.5 py-0.5 text-xs font-medium text-green-300'>
            Write
          </span>
          <span className='text-muted-foreground truncate font-mono text-xs'>
            {shortPath(writeData.filePath)}
          </span>
        </div>
      </div>
      <div className='ml-6'>
        <NewContentViewer content={displayContent} fileName={writeData.filePath} />
      </div>
    </div>
  );
}

function GenericToolUseMessage({ message }: { message: AgentMessage }) {
  const preview = getToolPreview(message.toolName, message.toolInput);

  return (
    <div className='flex items-center gap-3 py-1'>
      <Wrench className='h-3.5 w-3.5 shrink-0 text-yellow-400/70' />
      <Popover>
        <PopoverTrigger asChild>
          <button className='flex max-w-full min-w-0 items-center gap-2 transition-colors hover:text-yellow-200'>
            <span className='inline-flex shrink-0 items-center rounded-md bg-yellow-400/10 px-1.5 py-0.5 text-xs font-medium text-yellow-300'>
              {message.toolName || 'Tool'}
            </span>
            {preview && (
              <span className='text-muted-foreground truncate font-mono text-xs'>{preview}</span>
            )}
          </button>
        </PopoverTrigger>
        {message.toolInput && (
          <PopoverContent
            align='start'
            side='bottom'
            avoidCollisions
            collisionPadding={16}
            className={POPOVER_CLASSES}
          >
            <div className={POPOVER_CODE_CLASSES}>
              <CopyButton text={message.toolInput} />
              <CodeBlock code={message.toolInput} lang='json' />
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

function ToolUseMessage({ message }: { message: AgentMessage }) {
  if (message.toolName === 'Edit') return <EditToolMessage message={message} />;
  if (message.toolName === 'Write') return <WriteToolMessage message={message} />;
  return <GenericToolUseMessage message={message} />;
}

function ToolResultMessage({
  message,
  parentToolName,
  parentToolInput,
}: {
  message: AgentMessage;
  parentToolName?: string;
  parentToolInput?: string;
}) {
  const preview = getResultPreview(message.content);

  // For Read tool results: strip line numbers and detect language from file path
  const isRead = parentToolName === 'Read';
  const displayCode = isRead ? stripLineNumbers(message.content) : message.content;
  const lang = useMemo(() => {
    if (isRead && parentToolInput) {
      try {
        const parsed = JSON.parse(parentToolInput);
        if (parsed.file_path) return langFromPath(parsed.file_path) || 'text';
      } catch {
        /* ignore */
      }
    }
    return guessLang(message.content, parentToolName);
  }, [message.content, parentToolName, parentToolInput, isRead]);

  return (
    <div className='flex items-center gap-3 py-1'>
      <CheckCircle className='h-3.5 w-3.5 shrink-0 text-green-400/50' />
      <Popover>
        <PopoverTrigger asChild>
          <button className='text-muted-foreground hover:text-foreground flex max-w-full min-w-0 items-center gap-2 text-xs transition-colors'>
            <span className='shrink-0 font-medium'>Result</span>
            {preview && <span className='truncate font-mono opacity-50'>{preview}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          side='bottom'
          avoidCollisions
          collisionPadding={16}
          className={POPOVER_CLASSES}
        >
          <div className='group/code relative min-w-0'>
            <CopyButton text={message.content} />
            <CodeBlock code={displayCode} lang={lang} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SystemMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex items-center gap-3 py-1.5'>
      <Info className='text-muted-foreground/50 h-3.5 w-3.5 shrink-0' />
      <span className='text-muted-foreground/70 text-xs'>{message.content}</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-3 rounded-lg bg-red-500/5 px-3 py-2.5'>
      <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-400' />
      <span className='text-sm text-red-300'>{message.content}</span>
    </div>
  );
}

function ResultMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-3'>
      <Terminal className='mt-0.5 h-4 w-4 shrink-0 text-green-400' />
      <div className='min-w-0 flex-1'>
        <span className='mb-1 block text-[10px] font-semibold tracking-wider text-green-400/80 uppercase'>
          Complete
        </span>
        <div className='text-sm'>
          <MarkdownRenderer>{message.content}</MarkdownRenderer>
        </div>
      </div>
    </div>
  );
}

function ThinkingMessage({ message }: { message: AgentMessage }) {
  const [expanded, setExpanded] = useState(false);
  const firstLine = message.content.split('\n')[0] || '';
  const preview = firstLine.length > 120 ? firstLine.slice(0, 120) + '...' : firstLine;

  return (
    <div className='py-1'>
      <button
        onClick={() => setExpanded(!expanded)}
        className='flex w-full items-center gap-2 text-left transition-colors hover:text-purple-300'
      >
        <Brain className='h-3.5 w-3.5 shrink-0 text-purple-400/60' />
        {expanded ?
          <ChevronDown className='h-3 w-3 shrink-0 text-purple-400/40' />
        : <ChevronRight className='h-3 w-3 shrink-0 text-purple-400/40' />}
        <span className='text-muted-foreground truncate text-xs italic'>{preview}</span>
      </button>
      {expanded && (
        <div className='mt-1 ml-8 rounded border border-purple-400/10 bg-purple-500/5 px-3 py-2'>
          <p className='text-xs whitespace-pre-wrap text-purple-200/70 italic'>{message.content}</p>
        </div>
      )}
    </div>
  );
}

function ToolBatchGroup({ group }: { group: MessageGroupToolBatch }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className='ml-1 border-l border-yellow-400/15 pl-3'>
      <button
        onClick={() => setExpanded(!expanded)}
        className='flex w-full items-center gap-2 py-1 text-left transition-colors hover:text-yellow-200'
      >
        <Wrench className='h-3.5 w-3.5 shrink-0 text-yellow-400/70' />
        {expanded ?
          <ChevronDown className='h-3 w-3 shrink-0 text-yellow-400/50' />
        : <ChevronRight className='h-3 w-3 shrink-0 text-yellow-400/50' />}
        <span className='inline-flex shrink-0 items-center rounded-md bg-yellow-400/10 px-1.5 py-0.5 text-xs font-medium text-yellow-300'>
          {group.toolName}
        </span>
        <span className='text-muted-foreground text-xs'>({group.count} calls)</span>
      </button>
      {expanded && (
        <div className='mt-1 space-y-0.5'>
          {group.pairs.map(pair => {
            const toolUse = pair[0];
            return (
              <div key={toolUse.id}>
                {pair.map(msg => (
                  <MessageBlock
                    key={msg.id}
                    message={msg}
                    parentToolName={toolUse.toolName}
                    parentToolInput={toolUse.toolInput}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageBlock({
  message,
  parentToolName,
  parentToolInput,
}: {
  message: AgentMessage;
  parentToolName?: string;
  parentToolInput?: string;
}) {
  switch (message.type) {
    case 'user':
      return <UserMessage message={message} />;
    case 'thinking':
      return <ThinkingMessage message={message} />;
    case 'assistant_text':
      return <AssistantTextMessage message={message} />;
    case 'tool_use':
      return <ToolUseMessage message={message} />;
    case 'tool_result':
      return (
        <ToolResultMessage
          message={message}
          parentToolName={parentToolName}
          parentToolInput={parentToolInput}
        />
      );
    case 'system':
      return <SystemMessage message={message} />;
    case 'error':
      return <ErrorMessage message={message} />;
    case 'result':
      return <ResultMessage message={message} />;
    default:
      return null;
  }
}

// --- Main Component ---

interface AgentTerminalProps {
  messages: AgentMessage[];
  streamingText: string;
  streamingThinking?: string;
}

export function AgentTerminal({ messages, streamingText, streamingThinking }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingThinking]);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <div className='space-y-1 px-4 py-3'>
        {groups.map(group => {
          if (group.type === 'tool_batch') {
            return <ToolBatchGroup key={group.pairs[0][0].id} group={group} />;
          }
          if (group.type === 'tool_pair') {
            const toolUse = group.messages[0];
            return (
              <div key={toolUse.id} className='ml-1 border-l border-yellow-400/15 pl-3'>
                {group.messages.map(msg => (
                  <MessageBlock
                    key={msg.id}
                    message={msg}
                    parentToolName={toolUse.toolName}
                    parentToolInput={toolUse.toolInput}
                  />
                ))}
              </div>
            );
          }
          return <MessageBlock key={group.messages[0].id} message={group.messages[0]} />;
        })}

        {/* Streaming thinking */}
        {streamingThinking && (
          <div className='flex items-start gap-2 py-1'>
            <Brain className='mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-purple-400/60' />
            <span className='text-muted-foreground text-xs whitespace-pre-wrap italic'>
              {streamingThinking}
              <span className='inline-block animate-pulse text-purple-400'>|</span>
            </span>
          </div>
        )}

        {/* Streaming text */}
        {streamingText && (
          <div className='flex gap-3 py-2'>
            <Bot className='mt-0.5 h-4 w-4 shrink-0 animate-pulse text-blue-400' />
            <div className='min-w-0 flex-1'>
              <span className='text-sm whitespace-pre-wrap'>
                {streamingText}
                <span className='inline-block animate-pulse text-blue-400'>|</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
