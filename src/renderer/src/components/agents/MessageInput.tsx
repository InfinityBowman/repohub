import { useState, useCallback, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { AgentState } from '@/types';

const PLACEHOLDERS: Partial<Record<AgentState, string>> = {
  starting: 'Agent is starting...',
  connected: 'Agent is connecting...',
  working: 'Agent is working...',
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
    (e: React.KeyboardEvent) => {
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
    <div>
      <div
        className={`bg-card flex items-end gap-2 rounded-lg border p-2 transition-all ${
          showFocusRing
            ? 'border-blue-500/40 ring-1 ring-blue-500/30'
            : 'border-border'
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
          className='bg-transparent text-foreground placeholder:text-muted-foreground min-h-[36px] flex-1 resize-none border-none px-2 py-1.5 text-sm outline-none disabled:opacity-50'
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size='sm'
              className='h-8 w-8 shrink-0 p-0'
              disabled={!canSend || !value.trim()}
              onClick={handleSend}
            >
              <Send className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Send message</TooltipContent>
        </Tooltip>
      </div>
      {focused && canSend && (
        <p className='text-muted-foreground mt-1 px-2 text-[10px]'>
          Enter to send · Shift+Enter for newline
        </p>
      )}
    </div>
  );
}
