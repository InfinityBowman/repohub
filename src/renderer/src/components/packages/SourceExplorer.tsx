import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FileBrowser } from '@/components/ui/file-browser';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { usePackages } from '@/hooks/usePackages';

export function SourceExplorer({ packageName, repoUrl }: { packageName: string; repoUrl: string }) {
  const { cloneStatuses, cloningPackages, error, clonePackage, loadCloneStatus } = usePackages();

  const cloneStatus = cloneStatuses[packageName];
  const isCloning = cloningPackages.has(packageName);

  useEffect(() => {
    loadCloneStatus(packageName);
  }, [packageName, loadCloneStatus]);

  const handleClone = useCallback(() => {
    if (repoUrl) clonePackage(packageName, repoUrl);
  }, [packageName, repoUrl, clonePackage]);

  // Bind IPC calls to this package
  const listFiles = useCallback(
    (relativePath: string) => window.electron.packageClone.listFiles(packageName, relativePath),
    [packageName],
  );

  const readFile = useCallback(
    (relativePath: string) => window.electron.packageClone.readFile(packageName, relativePath),
    [packageName],
  );

  // ─── Not cloned ────────────────────────────────────────
  if (!cloneStatus?.cloned && !isCloning) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <div className='max-w-sm text-center'>
          <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-400/10'>
            <Download className='h-6 w-6 text-blue-400/60' />
          </div>
          <h3 className='text-sm font-medium'>Clone & Explore</h3>
          <p className='text-muted-foreground mt-1.5 text-xs leading-relaxed'>
            Shallow-clone this package&apos;s GitHub repository to browse its source code inline.
          </p>
          {repoUrl ?
            <>
              <p className='text-muted-foreground/50 mt-2 truncate font-mono text-[10px]'>
                {repoUrl}
              </p>
              <Button
                onClick={handleClone}
                className='mt-4 gap-2 bg-blue-400/15 text-blue-400 hover:bg-blue-400/25'
                size='sm'
              >
                <Download className='h-3.5 w-3.5' />
                Clone Repository
              </Button>
            </>
          : <p className='mt-3 text-xs text-red-400/80'>
              No GitHub repository URL found for this package.
            </p>
          }
          {error && (
            <div className='mt-3 flex items-center justify-center gap-1.5 text-xs text-red-400'>
              <AlertCircle className='h-3 w-3' />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Cloning ───────────────────────────────────────────
  if (isCloning) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <div className='text-center'>
          <Loader2 className='text-muted-foreground mx-auto mb-3 h-6 w-6 animate-spin' />
          <p className='text-sm font-medium'>Cloning repository...</p>
          <p className='text-muted-foreground mt-1 text-xs'>This may take a few seconds</p>
        </div>
      </div>
    );
  }

  // ─── Cloned — delegate to FileBrowser ──────────────────
  return <FileBrowser listFiles={listFiles} readFile={readFile} />;
}
