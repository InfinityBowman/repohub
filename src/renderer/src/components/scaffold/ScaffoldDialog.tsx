import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  FolderOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScaffoldTerminal } from './ScaffoldTerminal'
import type { ScaffoldRecipe, ScaffoldTemplate } from '@/types'

type Step = 'pick' | 'name' | 'running' | 'done'
type PickMode = 'templates' | 'recipes'
type SelectedItem =
  | { type: 'template'; template: ScaffoldTemplate }
  | { type: 'recipe'; recipe: ScaffoldRecipe }

interface ScaffoldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScaffoldDialog({ open, onOpenChange }: ScaffoldDialogProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [pickMode, setPickMode] = useState<PickMode>('templates')
  const [templates, setTemplates] = useState<ScaffoldTemplate[]>([])
  const [recipes, setRecipes] = useState<ScaffoldRecipe[]>([])
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [projectName, setProjectName] = useState('')
  const [nameError, setNameError] = useState('')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [finishedProjectName, setFinishedProjectName] = useState('')
  const [copyError, setCopyError] = useState('')

  // Recipe editor state
  const [editingRecipe, setEditingRecipe] = useState<ScaffoldRecipe | null>(null)
  const [editName, setEditName] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const loadData = useCallback(async () => {
    const [t, r] = await Promise.all([
      window.electron.scaffold.getTemplates(),
      window.electron.scaffold.getRecipes(),
    ])
    setTemplates(t)
    setRecipes(r)
  }, [])

  useEffect(() => {
    if (open) {
      loadData()
      setStep('pick')
      setPickMode('templates')
      setSelected(null)
      setProjectName('')
      setNameError('')
      setExitCode(null)
      setFinishedProjectName('')
      setCopyError('')
      setEditingRecipe(null)
    }
  }, [open, loadData])

  const validateName = (name: string): string => {
    if (!name.trim()) return 'Project name is required'
    if (/\s/.test(name)) return 'No spaces allowed'
    if (!/^[a-zA-Z0-9._-]+$/.test(name))
      return 'Only letters, numbers, dots, hyphens, underscores'
    return ''
  }

  const handleSelect = (item: SelectedItem) => {
    setSelected(item)
    setProjectName('')
    setNameError('')
    setCopyError('')
    setStep('name')
  }

  const handleCreate = async () => {
    const error = validateName(projectName)
    if (error) {
      setNameError(error)
      return
    }
    if (!selected) return

    if (selected.type === 'template') {
      // Template flow: instant copy, no terminal
      const result = await window.electron.scaffold.createFromTemplate(
        selected.template.name,
        projectName,
      )
      if (result.success) {
        setExitCode(0)
        setFinishedProjectName(projectName)
        setStep('done')
      } else {
        setCopyError(result.error || 'Failed to create project')
      }
    } else {
      // Recipe flow: PTY terminal
      setStep('running')
      const result = await window.electron.scaffold.run(
        selected.recipe.id,
        projectName,
      )
      if (!result.success) {
        setExitCode(1)
        setFinishedProjectName(projectName)
        setStep('done')
      }
    }
  }

  const handleDone = useCallback(
    (data: { exitCode: number; projectName: string }) => {
      setExitCode(data.exitCode)
      setFinishedProjectName(data.projectName)
      setStep('done')
    },
    [],
  )

  const handleOpenProject = async () => {
    onOpenChange(false)
    const repos = await window.electron.repositories.rescan()
    const newRepo = repos.find(
      (r: any) =>
        r.name === finishedProjectName ||
        r.name.endsWith('/' + finishedProjectName),
    )
    if (newRepo) {
      navigate(`/repo/${newRepo.id}`)
    }
  }

  const handleCancel = () => {
    window.electron.scaffold.cancel()
  }

  const handleBack = () => {
    if (step === 'name') {
      setStep('pick')
      setSelected(null)
    }
  }

  // Recipe CRUD
  const startEditing = (recipe: ScaffoldRecipe | null) => {
    if (recipe) {
      setEditingRecipe(recipe)
      setEditName(recipe.name)
      setEditCommand(recipe.command)
      setEditDescription(recipe.description)
      setEditCategory(recipe.category)
    } else {
      setEditingRecipe({ id: '', name: '', description: '', command: '', category: '', applySetupFiles: false })
      setEditName('')
      setEditCommand('')
      setEditDescription('')
      setEditCategory('')
    }
  }

  const saveRecipe = async () => {
    if (!editName.trim() || !editCommand.trim()) return
    const id = editingRecipe?.id || editName.toLowerCase().replace(/\s+/g, '-')
    await window.electron.scaffold.addRecipe({
      id,
      name: editName.trim(),
      description: editDescription.trim(),
      command: editCommand.trim(),
      category: editCategory.trim() || 'Custom',
      applySetupFiles: false,
    })
    setEditingRecipe(null)
    await loadData()
  }

  const deleteRecipe = async (id: string) => {
    await window.electron.scaffold.removeRecipe(id)
    await loadData()
  }

  const resolvedCommand =
    selected?.type === 'recipe'
      ? selected.recipe.command.replace(/\{name\}/g, projectName || '{name}')
      : ''

  const isRecipeFlow = selected?.type === 'recipe'
  const isRunningOrDone = step === 'running' || step === 'done'

  return (
    <Dialog open={open} onOpenChange={step === 'running' ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl overflow-hidden"
        showCloseButton={step !== 'running'}
        onInteractOutside={step === 'running' ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={step === 'running' ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(step === 'name' || (step === 'pick' && pickMode === 'recipes')) && (
              <button
                onClick={() => {
                  if (step === 'name') handleBack()
                  else setPickMode('templates')
                }}
                className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <DialogTitle>
              {step === 'pick' && (pickMode === 'templates' ? 'New Project' : 'Custom Recipes')}
              {step === 'name' &&
                (selected?.type === 'template'
                  ? selected.template.name
                  : selected?.recipe.name)}
              {step === 'running' && 'Scaffolding...'}
              {step === 'done' && (exitCode === 0 ? 'Project Created' : 'Scaffold Failed')}
            </DialogTitle>
          </div>
          {step === 'pick' && pickMode === 'templates' && (
            <DialogDescription>
              {templates.length > 0
                ? 'Choose a template to create a new project.'
                : 'Set a project templates directory in Settings to get started.'}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Step 1: Pick — Templates */}
        {step === 'pick' && pickMode === 'templates' && (
          <div className="flex flex-col gap-3">
            {templates.length > 0 ? (
              <ScrollArea className="max-h-[400px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 pr-3">
                  {templates.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => handleSelect({ type: 'template', template: t })}
                      className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20"
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No templates found. Add template directories to your project templates folder.
              </div>
            )}
            {recipes.length > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setPickMode('recipes')}>
                  <TerminalIcon className="h-3.5 w-3.5" />
                  Custom Recipes ({recipes.length})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Pick — Recipes (secondary) */}
        {step === 'pick' && pickMode === 'recipes' && (
          <div className="flex flex-col gap-3">
            {editingRecipe ? (
              <div className="flex flex-col gap-3">
                <Input placeholder="Recipe name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Input placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                <Input
                  placeholder="Command (use {name} for project name)"
                  value={editCommand}
                  onChange={(e) => setEditCommand(e.target.value)}
                />
                <Input placeholder="Category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingRecipe(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveRecipe} disabled={!editName.trim() || !editCommand.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="max-h-[320px] overflow-y-auto">
                  <div className="flex flex-col gap-1 pr-3">
                    {recipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-secondary/50 cursor-pointer"
                        onClick={() => handleSelect({ type: 'recipe', recipe })}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{recipe.name}</span>
                            {recipe.category && (
                              <Badge variant="secondary" className="text-[10px]">
                                {recipe.category}
                              </Badge>
                            )}
                          </div>
                          <code className="text-xs text-muted-foreground truncate">
                            {recipe.command}
                          </code>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => { e.stopPropagation(); startEditing(recipe) }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe.id) }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {recipes.length === 0 && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No custom recipes yet.
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => startEditing(null)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Recipe
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Name Project */}
        {step === 'name' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                placeholder="my-project"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value)
                  setNameError('')
                  setCopyError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
                autoFocus
              />
              {nameError && <span className="text-xs text-destructive">{nameError}</span>}
              {copyError && <span className="text-xs text-destructive">{copyError}</span>}
            </div>

            {selected?.type === 'template' ? (
              <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
                Copy <span className="font-medium text-foreground">{selected.template.name}</span> template into a new project directory.
              </div>
            ) : selected?.type === 'recipe' && selected.recipe.url ? (
              <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground flex flex-col gap-1">
                <p>This will open <span className="font-medium text-foreground">{selected.recipe.url}</span> in your browser.</p>
                <p>Configure your project there, then paste the generated command into the terminal.</p>
              </div>
            ) : (
              <div className="rounded-md bg-secondary/50 p-3">
                <code className="text-xs text-muted-foreground break-all">{resolvedCommand}</code>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={!projectName.trim()}>
                {selected?.type === 'template' ? 'Create' : selected?.type === 'recipe' && selected.recipe.url ? 'Open & Start' : 'Create'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 & 4: Terminal (recipe flow only — stays mounted through running → done) */}
        {isRecipeFlow && isRunningOrDone && (
          <div className="flex flex-col gap-3">
            <ScaffoldTerminal onDone={handleDone} disabled={step === 'done'} />

            {step === 'running' && (
              <div className="flex items-center justify-between">
                {selected?.type === 'recipe' && selected.recipe.url ? (
                  <span className="text-xs text-muted-foreground">
                    Paste the command from your browser. Type <kbd className="bg-muted rounded px-1 py-0.5 text-[10px] font-medium">exit</kbd> when done.
                  </span>
                ) : (
                  <span />
                )}
                <Button variant="destructive" size="sm" onClick={handleCancel}>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            )}

            {step === 'done' && (
              <DoneActions
                exitCode={exitCode}
                projectName={finishedProjectName}
                onRetry={() => { setStep('name'); setExitCode(null) }}
                onClose={() => onOpenChange(false)}
                onOpen={handleOpenProject}
              />
            )}
          </div>
        )}

        {/* Step 4: Done (template flow — no terminal) */}
        {!isRecipeFlow && step === 'done' && (
          <DoneActions
            exitCode={exitCode}
            projectName={finishedProjectName}
            onRetry={() => { setStep('name'); setExitCode(null) }}
            onClose={() => onOpenChange(false)}
            onOpen={handleOpenProject}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DoneActions({
  exitCode,
  projectName,
  onRetry,
  onClose,
  onOpen,
}: {
  exitCode: number | null
  projectName: string
  onRetry: () => void
  onClose: () => void
  onOpen: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        {exitCode === 0 ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm font-medium">{projectName} created successfully</p>
          </>
        ) : (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <X className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm font-medium">Scaffold failed (exit code {exitCode})</p>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {exitCode !== 0 && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
        {exitCode === 0 && (
          <Button size="sm" onClick={onOpen}>
            Open Project
          </Button>
        )}
      </div>
    </>
  )
}
