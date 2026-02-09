import { useState, useEffect } from 'react'
import { Save, Plus, X, FolderOpen } from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export function SettingsView() {
  const { config, update } = useConfig()
  const [scanDir, setScanDir] = useState('')
  const [patterns, setPatterns] = useState<string[]>([])
  const [newPattern, setNewPattern] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config) {
      setScanDir(config.scanDirectory)
      setPatterns([...config.ignorePatterns])
    }
  }, [config])

  const handleSave = async () => {
    await update({
      scanDirectory: scanDir,
      ignorePatterns: patterns,
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
