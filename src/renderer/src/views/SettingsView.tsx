import { useState, useEffect } from 'react'
import { Save, Plus, X, FileCode, FolderOpen, Search, Palette, Moon, Check } from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export function SettingsView() {
  const { config, update } = useConfig()
  const [scanDir, setScanDir] = useState('')
  const [projectTemplatesDir, setProjectTemplatesDir] = useState('')
  const [setupTemplateDir, setSetupTemplateDir] = useState('')
  const [patterns, setPatterns] = useState<string[]>([])
  const [newPattern, setNewPattern] = useState('')
  const [codeSearchEnabled, setCodeSearchEnabled] = useState(true)
  const [codeSearchExcludePatterns, setCodeSearchExcludePatterns] = useState<string[]>([])
  const [newSearchPattern, setNewSearchPattern] = useState('')
  const [codeSearchMaxFileSize, setCodeSearchMaxFileSize] = useState(1024)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config) {
      setScanDir(config.scanDirectory)
      setProjectTemplatesDir(config.projectTemplatesDir || '')
      setSetupTemplateDir(config.setupTemplateDir || '')
      setPatterns([...config.ignorePatterns])
      setCodeSearchEnabled(config.codeSearchEnabled ?? true)
      setCodeSearchExcludePatterns([...(config.codeSearchExcludePatterns || [])])
      setCodeSearchMaxFileSize(Math.round((config.codeSearchMaxFileSize || 1_048_576) / 1024))
    }
  }, [config])

  const addSearchPattern = () => {
    if (newSearchPattern.trim() && !codeSearchExcludePatterns.includes(newSearchPattern.trim())) {
      setCodeSearchExcludePatterns([...codeSearchExcludePatterns, newSearchPattern.trim()])
      setNewSearchPattern('')
    }
  }

  const removeSearchPattern = (index: number) => {
    setCodeSearchExcludePatterns(codeSearchExcludePatterns.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    await update({
      scanDirectory: scanDir,
      projectTemplatesDir,
      setupTemplateDir,
      ignorePatterns: patterns,
      codeSearchEnabled,
      codeSearchExcludePatterns,
      codeSearchMaxFileSize: codeSearchMaxFileSize * 1024,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addPattern = () => {
    if (newPattern.trim() && !patterns.includes(newPattern.trim())) {
      setPatterns([...patterns, newPattern.trim()])
      setNewPattern('')
    }
  }

  const removePattern = (index: number) => {
    setPatterns(patterns.filter((_, i) => i !== index))
  }

  if (!config) {
    return <div className="py-12 text-center text-muted-foreground">Loading settings...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Settings</h2>
        <Button onClick={handleSave} size="sm">
          <Save />
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose your preferred color scheme. Both themes are dark mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => update({ theme: 'default' })}
              className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                config.theme !== 'palenight'
                  ? 'border-primary bg-accent'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              {config.theme !== 'palenight' && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              <Moon className="h-6 w-6" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-medium">Default Dark</span>
                <span className="text-xs text-muted-foreground">Neutral grays</span>
              </div>
              <div className="flex gap-1">
                <span className="h-3 w-3 rounded-full" style={{ background: '#1a1a1a' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#3a3a3a' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#fafafa' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#6366f1' }} />
              </div>
            </button>
            <button
              onClick={() => update({ theme: 'palenight' })}
              className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                config.theme === 'palenight'
                  ? 'border-primary bg-accent'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              {config.theme === 'palenight' && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              <Palette className="h-6 w-6" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-medium">Palenight</span>
                <span className="text-xs text-muted-foreground">Material colors</span>
              </div>
              <div className="flex gap-1">
                <span className="h-3 w-3 rounded-full" style={{ background: '#1e2030' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#292D3E' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#C792EA' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#82AAFF' }} />
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scan Directory</CardTitle>
          <CardDescription>
            The root directory to scan for repositories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Input
              value={scanDir}
              onChange={(e) => setScanDir(e.target.value)}
              placeholder="/Users/you/Documents/Repos"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ignore Patterns</CardTitle>
          <CardDescription>
            Glob patterns for directories to exclude from the repository list.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {patterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"
              >
                <code className="text-sm">{pattern}</code>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removePattern(index)}
                  className="text-muted-foreground hover:text-destructive-foreground"
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="e.g. **/ThirdParty/**"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addPattern()
              }}
            />
            <Button variant="outline" size="sm" onClick={addPattern}>
              <Plus />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Templates Directory</CardTitle>
          <CardDescription>
            A directory where each subdirectory is a project template. Used by "New Project" to create projects by copying a template.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Input
              value={projectTemplatesDir}
              onChange={(e) => setProjectTemplatesDir(e.target.value)}
              placeholder="~/Templates/projects"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Template Directory</CardTitle>
          <CardDescription>
            Path to a directory containing template files (eslint, prettier, CLAUDE.md, etc.) to copy into new projects after scaffolding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <Input
              value={setupTemplateDir}
              onChange={(e) => setSetupTemplateDir(e.target.value)}
              placeholder="~/dotfiles/project-templates"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Code Search
          </CardTitle>
          <CardDescription>
            Configure the semantic code search engine. Indexes your codebase locally for natural language search.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={codeSearchEnabled}
              onChange={(e) => setCodeSearchEnabled(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">Enable code search indexing</span>
          </label>

          <Separator />

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Max file size:</span>
            <Input
              type="number"
              value={codeSearchMaxFileSize}
              onChange={(e) => {
                const kb = parseInt(e.target.value, 10)
                if (kb >= 1) setCodeSearchMaxFileSize(kb)
              }}
              className="w-24"
              min={1}
            />
            <span className="text-sm text-muted-foreground">KB</span>
          </div>

          <Separator />

          <div>
            <span className="text-sm text-muted-foreground mb-2 block">Exclude patterns:</span>
            <div className="flex flex-col gap-2">
              {codeSearchExcludePatterns.map((pattern, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"
                >
                  <code className="text-sm">{pattern}</code>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeSearchPattern(index)}
                    className="text-muted-foreground hover:text-destructive-foreground"
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={newSearchPattern}
                onChange={(e) => setNewSearchPattern(e.target.value)}
                placeholder="e.g. **/vendor/**"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSearchPattern()
                }}
              />
              <Button variant="outline" size="sm" onClick={addSearchPattern}>
                <Plus />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Port Monitoring</CardTitle>
          <CardDescription>
            Configure how frequently ports are scanned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Scan interval:</span>
            <Input
              type="number"
              value={config.portScanInterval / 1000}
              onChange={(e) => {
                const seconds = parseInt(e.target.value, 10)
                if (seconds >= 1) {
                  update({ portScanInterval: seconds * 1000 })
                }
              }}
              className="w-20"
              min={1}
            />
            <span className="text-sm text-muted-foreground">seconds</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
