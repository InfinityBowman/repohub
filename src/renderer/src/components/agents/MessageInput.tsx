import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import type { AgentState } from '@/types';

const PLACEHOLDERS: Partial<Record<AgentState, string>> = {
  starting: 'Agent is starting...',
  connected: 'Agent is connecting...',
  working: 'Agent is working...',
  stopping: 'Agent is stopping...',
  waiting_permission: 'Respond to permission request above...',
  error: 'Agent encountered an error',
  completed: 'Send a follow-up message...',
  idle: 'Send a follow-up message...',
};

interface MessageInputProps {
  agentState: AgentState;
  onSend: (content: string) => void;
}

export function MessageInput({ agentState, onSend }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = agentState === 'idle' || agentState === 'completed';

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || !canSend) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, canSend, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, []);

  const placeholder = PLACEHOLDERS[agentState] || 'Waiting for agent...';
  const showFocusRing = focused && canSend;

  return (
    <div
      className={`bg-card flex items-end gap-2 rounded-lg border px-3 py-2 transition-colors ${
        showFocusRing ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-border'
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={!canSend}
        rows={1}
        className='text-foreground placeholder:text-muted-foreground min-h-8 flex-1 resize-none border-none bg-transparent py-1 text-sm leading-6 outline-none disabled:opacity-50'
      />
      <div className='flex shrink-0 items-center gap-2'>
        <span
          className={`text-muted-foreground/50 text-[10px] transition-opacity ${focused && canSend ? 'opacity-100' : 'opacity-0'}`}
        >
          Enter to send
        </span>
        <button
          disabled={!canSend || !value.trim()}
          onClick={handleSend}
          className='text-muted-foreground mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:text-blue-400 disabled:pointer-events-none disabled:opacity-30'
        >
          <Send className='h-3.5 w-3.5' />
        </button>
      </div>
    </div>
  );
}
