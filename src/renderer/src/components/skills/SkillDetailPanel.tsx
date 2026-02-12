import { useMemo } from 'react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Loader2, Sparkles, Check, FileText, FolderDown, ExternalLink } from 'lucide-react';
import { SecurityBadge } from './SecurityBadge';
import { scanSkillFiles } from '@/lib/skill-scanner';
import type { SkillDetail } from '@/types';

export function SkillDetailPanel({
  skill,
  installing,
  installSuccess,
  onInstall,
}: {
  skill: SkillDetail;
  installing: boolean;
  installSuccess: boolean;
  onInstall: () => void;
}) {
  const source = skill.sourceId;

  // Scan all skill files for hidden prompt injection vectors
  const warnings = useMemo(
    () => scanSkillFiles(skill.content, skill.description || '', skill.allTextContent),
    [skill.content, skill.description, skill.allTextContent],
  );

  return (
    <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
      {/* Header */}
      <div className='relative shrink-0 px-8 pt-6 pb-5'>
        <div className='flex items-start gap-5'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-baseline gap-3'>
              <Sparkles className='h-5 w-5 shrink-0 text-purple-400/60' />
              <span className='text-xl font-bold tracking-tight'>{skill.name}</span>
              {skill.version && (
                <span className='font-mono text-sm text-purple-400/70'>v{skill.version}</span>
              )}
            </div>
            <p className='text-muted-foreground/80 mt-1.5 text-xs leading-relaxed'>
              {skill.description}
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <Badge
                variant='outline'
                className='gap-1 rounded-full border-blue-800/40 bg-blue-900/15 text-[10px] text-blue-400/80'
              >
                {source}
              </Badge>
              {skill.tags.map(tag => (
                <Badge key={tag} variant='outline' className='rounded-full text-[10px]'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            <SecurityBadge warnings={warnings} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='sm'
                  variant='ghost'
                  className='gap-1.5'
                  onClick={() => window.electron.shell.openUrl(`https://skills.sh/${source}/${skill.path}`)}
                >
                  <ExternalLink className='h-3.5 w-3.5' />
                  skills.sh
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>View on skills.sh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='sm'
                  variant='outline'
                  className='gap-1.5'
                  onClick={onInstall}
                  disabled={installing}
                >
                  {installing ?
                    <>
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      Installing...
                    </>
                  : installSuccess ?
                    <>
                      <Check className='h-3.5 w-3.5 text-green-400' />
                      Installed
                    </>
                  : <>
                      <FolderDown className='h-3.5 w-3.5' />
                      Install
                    </>
                  }
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-xs'>Install skill to a directory</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className='via-border/40 absolute right-8 bottom-0 left-8 h-px bg-linear-to-r from-transparent to-transparent' />
      </div>

      {/* Files list */}
      {skill.files.length > 0 && (
        <div className='shrink-0 px-8 py-4'>
          <div className='flex flex-wrap items-center gap-2'>
            {skill.files.map(file => (
              <div
                key={file}
                className='bg-secondary/30 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]'
              >
                <FileText className='text-muted-foreground/50 h-3 w-3' />
                <span className='text-muted-foreground/80'>{file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className='shrink-0 px-8'>
        <div className='via-border/25 h-px bg-linear-to-r from-transparent to-transparent' />
      </div>

      {/* Content */}
      <div className='min-h-0 flex-1 overflow-y-auto px-8 py-6'>
        {skill.content.trim() ?
          <MarkdownRenderer>{skill.content}</MarkdownRenderer>
        : <div className='text-muted-foreground py-8 text-center text-sm'>
            No content available for this skill.
          </div>
        }
      </div>
    </div>
  );
}
