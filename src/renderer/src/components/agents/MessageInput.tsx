import { useState, useCallback, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentState } from '@/types';

interface MessageInputProps {
  agentState: AgentState;
  onSend: (content: string) => void;
}

export function MessageInput({ agentState, onSend }: MessageInputProps) {
  const [value, setValue] = useState('');
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

  return (
    <div className='bg-card border-border flex items-end gap-2 rounded-lg border p-2'>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={canSend ? 'Send a follow-up message...' : 'Waiting for agent...'}
        disabled={!canSend}
        rows={1}
        className='bg-transparent text-foreground placeholder:text-muted-foreground min-h-[36px] flex-1 resize-none border-none px-2 py-1.5 text-sm outline-none disabled:opacity-50'
      />
      <Button
        size='sm'
        className='h-8 w-8 shrink-0 p-0'
        disabled={!canSend || !value.trim()}
        onClick={handleSend}
      >
        <Send className='h-4 w-4' />
      </Button>
    </div>
  );
}
