import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Wrench,
  AlertCircle,
  User,
  Bot,
  Info,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';
import { CodeBlock } from '@/components/ui/code-block';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { PermissionRequestInline } from './PermissionRequestInline';
import type { AgentMessage, PermissionRequest } from '@/types';

// --- Helpers ---

/** Extract a short preview string from tool input JSON */
export function getToolPreview(toolName?: string, toolInput?: string): string {
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
        // Show first string value
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
      className='text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded p-1 opacity-0 transition-all group-hover/code:opacity-100'
      title='Copy'
    >
      {copied ? <Check className='h-3.5 w-3.5 text-green-400' /> : <Copy className='h-3.5 w-3.5' />}
    </button>
  );
}

// --- Tool use + result grouping helper ---

interface MessageGroup {
  type: 'single' | 'tool_pair';
  messages: AgentMessage[];
}

function groupMessages(messages: AgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    // Group consecutive tool_use → tool_result pairs
    if (msg.type === 'tool_use' && i + 1 < messages.length && messages[i + 1].type === 'tool_result') {
      groups.push({ type: 'tool_pair', messages: [msg, messages[i + 1]] });
      i += 2;
    } else {
      groups.push({ type: 'single', messages: [msg] });
      i += 1;
    }
  }
  return groups;
}

// --- Message Blocks ---

function UserMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-2 py-1.5'>
      <User className='mt-0.5 h-4 w-4 shrink-0 text-purple-400' />
      <div className='min-w-0 flex-1'>
        <span className='whitespace-pre-wrap text-sm text-purple-300'>{message.content}</span>
      </div>
    </div>
  );
}

function AssistantTextMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-2 py-1.5'>
      <Bot className='mt-0.5 h-4 w-4 shrink-0 text-blue-400' />
      <div className='min-w-0 flex-1 text-sm'>
        <MarkdownRenderer className='prose-xs'>{message.content}</MarkdownRenderer>
      </div>
    </div>
  );
}

function ToolUseMessage({ message }: { message: AgentMessage }) {
  const [collapsed, setCollapsed] = useState(true);
  const preview = getToolPreview(message.toolName, message.toolInput);

  return (
    <div className='flex gap-2 py-1'>
      <Wrench className='mt-0.5 h-4 w-4 shrink-0 text-yellow-400' />
      <div className='min-w-0 flex-1'>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className='flex max-w-full items-center gap-1.5 text-sm transition-colors hover:text-yellow-200'
        >
          <span className='inline-flex shrink-0 items-center rounded bg-yellow-400/10 px-1.5 py-0.5 text-xs font-medium text-yellow-300'>
            {message.toolName || 'Tool'}
          </span>
          {preview && (
            <span className='text-muted-foreground truncate font-mono text-xs'>
              {preview}
            </span>
          )}
          {collapsed
            ? <ChevronRight className='h-3 w-3 shrink-0 text-yellow-400/60' />
            : <ChevronDown className='h-3 w-3 shrink-0 text-yellow-400/60' />
          }
        </button>
        {!collapsed && message.toolInput && (
          <div className='group/code relative mt-1'>
            <CopyButton text={message.toolInput} />
            <CodeBlock code={message.toolInput} lang='json' />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolResultMessage({ message }: { message: AgentMessage }) {
  const [collapsed, setCollapsed] = useState(true);
  const preview = getResultPreview(message.content);

  return (
    <div className='flex gap-2 py-1'>
      <CheckCircle className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className='text-muted-foreground hover:text-foreground flex max-w-full items-center gap-1.5 text-xs transition-colors'
        >
          <span>Result</span>
          {preview && collapsed && (
            <span className='truncate font-mono opacity-60'>
              {preview}
            </span>
          )}
          {collapsed
            ? <ChevronRight className='h-3 w-3 shrink-0' />
            : <ChevronDown className='h-3 w-3 shrink-0' />
          }
        </button>
        {!collapsed && (
          <div className='group/code relative mt-1'>
            <CopyButton text={message.content} />
            <CodeBlock code={message.content} lang={guessLang(message.content, message.toolName)} />
          </div>
        )}
      </div>
    </div>
  );
}

function SystemMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-2 py-1'>
      <Info className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
      <span className='text-muted-foreground text-xs italic'>{message.content}</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-2 py-1.5'>
      <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-400' />
      <span className='text-sm text-red-400'>{message.content}</span>
    </div>
  );
}

function ResultMessage({ message }: { message: AgentMessage }) {
  return (
    <div className='flex gap-2 rounded-lg border border-green-800/40 bg-green-900/10 p-3'>
      <Bot className='mt-0.5 h-4 w-4 shrink-0 text-green-400' />
      <div className='min-w-0 flex-1'>
        <span className='mb-2 block text-xs font-medium text-green-400'>Final Result</span>
        <div className='text-sm'>
          <MarkdownRenderer>{message.content}</MarkdownRenderer>
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ message }: { message: AgentMessage }) {
  switch (message.type) {
    case 'user':
      return <UserMessage message={message} />;
    case 'assistant_text':
      return <AssistantTextMessage message={message} />;
    case 'tool_use':
      return <ToolUseMessage message={message} />;
    case 'tool_result':
      return <ToolResultMessage message={message} />;
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
  permissions?: PermissionRequest[];
  onRespondPermission?: (requestId: string, allow: boolean) => void;
}

export function AgentTerminal({
  messages,
  streamingText,
  permissions,
  onRespondPermission,
}: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, permissions]);

  const groups = groupMessages(messages);

  return (
    <div className='flex-1 overflow-y-auto'>
      <div className='space-y-0.5 p-4'>
        {groups.map((group, gi) => {
          if (group.type === 'tool_pair') {
            return (
              <div key={group.messages[0].id} className='border-l-2 border-yellow-400/20 pl-3'>
                {group.messages.map(msg => (
                  <MessageBlock key={msg.id} message={msg} />
                ))}
              </div>
            );
          }
          return <MessageBlock key={group.messages[0].id} message={group.messages[0]} />;
        })}

        {/* Streaming text — plain, no markdown to avoid flicker */}
        {streamingText && (
          <div className='flex gap-2 py-1.5'>
            <Bot className='mt-0.5 h-4 w-4 shrink-0 animate-pulse text-blue-400' />
            <div className='min-w-0 flex-1'>
              <span className='whitespace-pre-wrap text-sm'>
                {streamingText}
                <span className='inline-block animate-pulse text-blue-400'>|</span>
              </span>
            </div>
          </div>
        )}

        {/* Inline permission requests */}
        {permissions && permissions.length > 0 && onRespondPermission && (
          <div className='mt-2 flex flex-col gap-2'>
            {permissions.map(p => (
              <PermissionRequestInline
                key={p.requestId}
                permission={p}
                onRespond={onRespondPermission}
              />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
