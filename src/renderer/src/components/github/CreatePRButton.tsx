import { GitPullRequestCreate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useGitHub } from '@/hooks/useGitHub'

export function CreatePRButton({ repoId }: { repoId: string }) {
  const { createPR } = useGitHub()

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await createPR(repoId)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={handleClick}>
          <GitPullRequestCreate className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Create Pull Request</TooltipContent>
    </Tooltip>
  )
}
