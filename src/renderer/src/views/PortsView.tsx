import { RefreshCw, Skull, ExternalLink } from 'lucide-react'
import { usePorts } from '@/hooks/usePorts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export function PortsView() {
  const { ports, monitoring, killByPort, refresh } = usePorts()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Open Ports</h2>
          {monitoring && (
            <Badge variant="outline" className="border-green-800/50 bg-green-900/30 text-green-400">
              <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              Monitoring
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {ports.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No open ports detected on localhost.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ports.map((port) => (
            <Card key={port.port} className="gap-0 py-0">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-16 items-center justify-center rounded-md bg-secondary font-mono text-sm font-semibold">
                    :{port.port}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{port.command}</span>
                      <span className="text-xs text-muted-foreground">PID {port.pid}</span>
                      {port.managed && (
                        <Badge variant="secondary" className="text-xs">
                          Managed
                        </Badge>
                      )}
                    </div>
                    {port.repoName && (
                      <p className="text-xs text-muted-foreground">
                        Project: {port.repoName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Open in browser - this is safe as it's localhost
                      window.open(`http://localhost:${port.port}`, '_blank')
                    }}
                  >
                    <ExternalLink />
                    Open
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive-foreground hover:bg-destructive/20"
                    onClick={() => killByPort(port.port)}
                  >
                    <Skull />
                    Kill
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
