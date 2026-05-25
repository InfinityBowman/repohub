import { useSystemMonitorStore } from '@/store/systemMonitorStore';

function ArcGauge({ value, label }: { value: number; label: string }) {
  const radius = 24;
  const strokeWidth = 4;
  const center = radius + strokeWidth;
  const size = (radius + strokeWidth) * 2;

  const arcDegrees = 252;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (arcDegrees / 360) * circumference;
  const fillLength = arcLength * (value / 100);

  const color =
    value > 80 ? 'var(--color-red-400, #f87171)'
    : value > 60 ? 'var(--color-amber-400, #fbbf24)'
    : 'hsl(var(--primary))';

  return (
    <div className='flex flex-col items-center gap-1.5'>
      <div className='relative' style={{ width: size, height: size }}>
        <svg width={size} height={size} className='-rotate-[108deg]'>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill='none'
            stroke='hsl(var(--muted))'
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            strokeDasharray={`${arcLength} ${circumference}`}
            className='opacity-40'
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill='none'
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            strokeDasharray={`${fillLength} ${circumference}`}
            className='transition-all duration-500 ease-out'
          />
        </svg>
        <div className='absolute inset-0 flex items-center justify-center'>
          <span className='text-sm font-medium tabular-nums'>{Math.round(value)}%</span>
        </div>
      </div>
      <span className='text-[10px] font-medium tracking-wide text-muted-foreground'>
        {label}
      </span>
    </div>
  );
}

export function SystemGauges() {
  const cpuPercent = useSystemMonitorStore(s => s.cpuPercent);
  const memUsedPercent = useSystemMonitorStore(s => s.memUsedPercent);

  return (
    <div className='flex items-center justify-center gap-8 pt-2'>
      <ArcGauge value={cpuPercent} label='CPU' />
      <ArcGauge value={memUsedPercent} label='MEM' />
    </div>
  );
}
