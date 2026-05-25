import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  label: string;
  count?: number;
  onExpand?: () => void;
}

export function SectionHeader({ label, count, onExpand }: SectionHeaderProps) {
  return (
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-2'>
        <span className='text-[10px] font-semibold tracking-[1px] text-muted-foreground'>
          {label}
        </span>
        {count !== undefined && count > 0 && (
          <span className='rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-muted-foreground'>
            {count}
          </span>
        )}
      </div>
      {onExpand && (
        <button
          onClick={onExpand}
          className='rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground'
        >
          <ChevronRight className='h-3 w-3' />
        </button>
      )}
    </div>
  );
}
