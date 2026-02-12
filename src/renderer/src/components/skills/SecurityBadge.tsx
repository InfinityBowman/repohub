import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { ScanWarning } from '@/lib/skill-scanner';

export function SecurityBadge({ warnings }: { warnings: ScanWarning[] }) {
  const hasHigh = warnings.some(w => w.severity === 'high');

  if (warnings.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='flex items-center gap-1 rounded-full border border-green-800/30 bg-green-900/10 px-2 py-1'>
            <ShieldCheck className='h-3 w-3 text-green-400/80' />
            <span className='text-[10px] text-green-400/80'>Clean</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className='text-xs'>
          All skill files scanned — no hidden content detected
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-1 transition-colors',
            hasHigh ?
              'border-red-800/40 bg-red-900/15 text-red-400 hover:bg-red-900/25'
            : 'border-yellow-800/40 bg-yellow-900/15 text-yellow-400 hover:bg-yellow-900/25',
          )}
        >
          <ShieldAlert className='h-3 w-3' />
          <span className='text-[10px] font-medium'>
            {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 p-0'>
        <div className='border-b border-white/5 px-4 py-3'>
          <p className='text-[11px] font-medium'>Potential prompt injection vectors</p>
          <p className='text-muted-foreground/60 mt-0.5 text-[10px]'>
            Hidden content detected across skill files that an agent could read but you can't see
          </p>
        </div>
        <div className='max-h-64 space-y-2 overflow-y-auto p-3'>
          {warnings.map((w, i) => (
            <div key={i} className='space-y-1'>
              <div className='flex items-center gap-2'>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                    w.severity === 'high' ? 'bg-red-900/30 text-red-400'
                    : w.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-400'
                    : 'bg-blue-900/30 text-blue-400',
                  )}
                >
                  {w.severity}
                </span>
                <span className='min-w-0 truncate text-[11px] text-white/70'>{w.message}</span>
              </div>
              {w.file && (
                <span className='text-muted-foreground/50 ml-0.5 font-mono text-[9px]'>
                  {w.file}
                </span>
              )}
              {w.details && (
                <pre className='max-h-20 overflow-auto rounded bg-black/30 px-2.5 py-1.5 font-mono text-[10px] text-white/50'>
                  {w.details}
                </pre>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
