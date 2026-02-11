import { useState } from 'react';
import { ShieldAlert, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PermissionRequest } from '@/types';

interface PermissionRequestInlineProps {
  permission: PermissionRequest;
  onRespond: (requestId: string, allow: boolean) => void;
}

export function PermissionRequestInline({ permission, onRespond }: PermissionRequestInlineProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className='border-amber-500/50 bg-amber-500/5'>
      <CardContent className='p-3'>
        <div className='flex items-start gap-3'>
          <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0 text-amber-400' />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium text-amber-300'>{permission.toolName}</span>
              {permission.description && (
                <span className='text-muted-foreground truncate text-xs'>
                  {permission.description}
                </span>
              )}
            </div>

            {permission.input && permission.input !== '{}' && (
              <div className='mt-1'>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors'
                >
                  {expanded ? <ChevronUp className='h-3 w-3' /> : <ChevronDown className='h-3 w-3' />}
                  {expanded ? 'Hide' : 'Show'} details
                </button>
                {expanded && (
                  <pre className='bg-secondary/50 mt-1 max-h-40 overflow-auto rounded p-2 text-xs'>
                    {permission.input}
                  </pre>
                )}
              </div>
            )}
          </div>

          <div className='flex shrink-0 gap-1'>
            <Button
              size='sm'
              variant='outline'
              className='h-7 border-green-600/50 text-green-400 hover:bg-green-600/20'
              onClick={() => onRespond(permission.requestId, true)}
            >
              <Check className='h-3 w-3' />
              Allow
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-7 border-red-600/50 text-red-400 hover:bg-red-600/20'
              onClick={() => onRespond(permission.requestId, false)}
            >
              <X className='h-3 w-3' />
              Deny
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
