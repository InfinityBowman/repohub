import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Wrench, AlertCircle, User, Bot, Info, CheckCircle } from 'lucide-react';
import type { AgentMessage } from '@/types';

interface AgentTerminalProps {
  messages: AgentMessage[];
  streamingText: string;
}

function MessageBlock({ message }: { message: AgentMessage }) {
  const [collapsed, setCollapsed] = useState(true);

  switch (message.type) {
    case 'user':
      return (
        <div className='flex gap-2 py-1.5'>
          <User className='mt-0.5 h-4 w-4 shrink-0 text-purple-400' />
          <div className='min-w-0 flex-1'>
            <span className='whitespace-pre-wrap text-sm text-purple-300'>{message.content}</span>
          </div>
        </div>
      );

    case 'assistant_text':
      return (
        <div className='flex gap-2 py-1.5'>
          <Bot className='mt-0.5 h-4 w-4 shrink-0 text-blue-400' />
          <div className='min-w-0 flex-1'>
            <span className='whitespace-pre-wrap text-sm'>{message.content}</span>
          </div>
        </div>
      );

    case 'tool_use':
      return (
        <div className='flex gap-2 py-1'>
          <Wrench className='mt-0.5 h-4 w-4 shrink-0 text-yellow-400' />
          <div className='min-w-0 flex-1'>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className='flex items-center gap-1 text-sm font-medium text-yellow-300 transition-colors hover:text-yellow-200'
            >
              {message.toolName || message.content}
              {collapsed ?
                <ChevronDown className='h-3 w-3' />
              : <ChevronUp className='h-3 w-3' />}
            </button>
            {!collapsed && message.toolInput && (
              <pre className='bg-secondary/50 mt-1 max-h-60 overflow-auto rounded p-2 text-xs'>
                {message.toolInput}
              </pre>
            )}
          </div>
        </div>
      );

    case 'tool_result':
      return (
        <div className='flex gap-2 py-1'>
          <CheckCircle className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
          <div className='min-w-0 flex-1'>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors'
            >
              Tool result
              {collapsed ?
                <ChevronDown className='h-3 w-3' />
              : <ChevronUp className='h-3 w-3' />}
            </button>
            {!collapsed && (
              <pre className='bg-secondary/30 mt-1 max-h-60 overflow-auto rounded p-2 text-xs'>
                {message.content}
              </pre>
            )}
          </div>
        </div>
      );

    case 'system':
      return (
        <div className='flex gap-2 py-1'>
          <Info className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
          <span className='text-muted-foreground text-xs italic'>{message.content}</span>
        </div>
      );

    case 'error':
      return (
        <div className='flex gap-2 py-1.5'>
          <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-400' />
          <span className='text-sm text-red-400'>{message.content}</span>
        </div>
      );

    case 'result':
      return (
        <div className='flex gap-2 py-1.5'>
          <Bot className='mt-0.5 h-4 w-4 shrink-0 text-green-400' />
          <div className='min-w-0 flex-1'>
            <span className='mb-1 block text-xs font-medium text-green-400'>Final Result</span>
            <span className='whitespace-pre-wrap text-sm'>{message.content}</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function AgentTerminal({ messages, streamingText }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div className='flex-1 overflow-y-auto'>
      <div className='space-y-0.5 p-4'>
        {messages.map(msg => (
          <MessageBlock key={msg.id} message={msg} />
        ))}

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

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
