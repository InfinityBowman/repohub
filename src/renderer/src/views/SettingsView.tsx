import { useState, useCallback, type ReactNode } from 'react';
import {
  Save,
  Plus,
  X,
  Search,
  Palette,
  Moon,
  Check,
  GitBranch,
  Radio,
  Hammer,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

/* ─── Primitives ──────────────────────────────────────────────────── */

/** A horizontal row: label+description left, control right */
function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className='group flex items-start justify-between gap-8 py-3.5'>
      <div className='min-w-0 flex-1'>
        <div className='text-[13px] font-medium text-foreground'>{label}</div>
        {description && (
          <div className='text-[12px] leading-relaxed text-muted-foreground mt-0.5'>
            {description}
          </div>
        )}
      </div>
      <div className='shrink-0 pt-0.5'>{children}</div>
    </div>
  );
}

/** Compact inline number + unit */
function NumInput({
  value,
  onChange,
  unit,
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  min?: number;
}) {
  return (
    <div className='flex items-center gap-2'>
      <Input
        type='number'
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (v >= min) onChange(v);
        }}
        className='h-8 w-20 text-[13px] text-center tabular-nums'
        min={min}
      />
      <span className='text-[12px] text-muted-foreground'>{unit}</span>
    </div>
  );
}

/** Editable tag cloud with add input */
function TagList({
  items,
  setItems,
  placeholder,
  mono,
}: {
  items: string[];
  setItems: (v: string[]) => void;
  placeholder: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      setItems([...items, trimmed]);
      setDraft('');
    }
  };

  return (
    <div className='flex flex-col gap-2.5'>
      {items.length > 0 && (
        <div className='flex flex-wrap gap-1.5 max-h-40 overflow-y-auto py-0.5'>
          {items.map((item, i) => (
            <span
              key={i}
              className='group/tag inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-1 text-[12px] leading-none transition-colors hover:bg-secondary'
            >
              <span className={mono ? 'font-mono' : ''}>{item}</span>
              <button
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className='text-muted-foreground/60 hover:text-destructive transition-colors -mr-0.5'
              >
                <X className='h-3 w-3' />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className='flex items-center gap-2'>
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className='h-8 text-[13px] flex-1'
        />
        <Button variant='ghost' size='xs' onClick={add} className='text-muted-foreground'>
          <Plus className='h-3 w-3' />
          Add
        </Button>
      </div>
    </div>
  );
}

/** Section heading inside a tab panel */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 pt-2 pb-1'>
      {children}
    </div>
  );
}

/** Thin divider between rows */
function Divider() {
  return <div className='border-t border-border/50' />;
}

/* ─── Nav data ────────────────────────────────────────────────────── */

const sections = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'repositories', label: 'Repositories', icon: GitBranch },
  { id: 'search', label: 'Code Search', icon: Search },
  { id: 'ports', label: 'Ports', icon: Radio },
  { id: 'scaffolding', label: 'Scaffolding', icon: Hammer },
] as const;

type SectionId = (typeof sections)[number]['id'];

/** Sidebar nav pill */
function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] w-full text-left transition-colors ${
        active
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      }`}
    >
      <Icon className='h-4 w-4 shrink-0' />
      {label}
    </button>
  );
}

/* ─── Main view ───────────────────────────────────────────────────── */

export function SettingsView() {
  const { config, update } = useConfig();
  const [activeTab, setActiveTab] = useState<SectionId>('general');

  // Form state
  const [scanDir, setScanDir] = useState('');
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
  const [protectedBranches, setProtectedBranches] = useState<string[]>([]);
  const [projectTemplatesDir, setProjectTemplatesDir] = useState('');
  const [setupTemplateDir, setSetupTemplateDir] = useState('');
  const [codeSearchEnabled, setCodeSearchEnabled] = useState(true);
  const [codeSearchExcludePatterns, setCodeSearchExcludePatterns] = useState<string[]>([]);
  const [codeSearchMaxFileSize, setCodeSearchMaxFileSize] = useState(1024);
  const [portScanInterval, setPortScanInterval] = useState(5);
  const [saved, setSaved] = useState(false);

  // Sync from config
  const [prevConfig, setPrevConfig] = useState(config);
  if (config && config !== prevConfig) {
    setPrevConfig(config);
    setScanDir(config.scanDirectory);
    setIgnorePatterns([...config.ignorePatterns]);
    setProtectedBranches([...config.protectedBranches]);
    setProjectTemplatesDir(config.projectTemplatesDir || '');
    setSetupTemplateDir(config.setupTemplateDir || '');
    setCodeSearchEnabled(config.codeSearchEnabled ?? true);
    setCodeSearchExcludePatterns([...(config.codeSearchExcludePatterns || [])]);
    setCodeSearchMaxFileSize(Math.round((config.codeSearchMaxFileSize || 1_048_576) / 1024));
    setPortScanInterval(Math.round((config.portScanInterval || 5000) / 1000));
  }

  const handleSave = useCallback(async () => {
    await update({
      scanDirectory: scanDir,
      ignorePatterns,
      protectedBranches,
      projectTemplatesDir,
      setupTemplateDir,
      codeSearchEnabled,
      codeSearchExcludePatterns,
      codeSearchMaxFileSize: codeSearchMaxFileSize * 1024,
      portScanInterval: portScanInterval * 1000,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [
    scanDir,
    ignorePatterns,
    protectedBranches,
    projectTemplatesDir,
    setupTemplateDir,
    codeSearchEnabled,
    codeSearchExcludePatterns,
    codeSearchMaxFileSize,
    portScanInterval,
    update,
  ]);

  if (!config) {
    return <div className='text-muted-foreground py-12 text-center text-sm'>Loading...</div>;
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center justify-between pb-5'>
        <h2 className='text-lg font-semibold tracking-tight'>Settings</h2>
        <Button
          onClick={handleSave}
          size='sm'
          className={`transition-all ${saved ? 'bg-green-600 hover:bg-green-600' : ''}`}
        >
          {saved ? <Check className='h-3.5 w-3.5' /> : <Save className='h-3.5 w-3.5' />}
          {saved ? 'Saved' : 'Save changes'}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className='flex gap-8 flex-1 min-h-0'>
        {/* Sidebar nav */}
        <nav className='flex flex-col gap-1 w-40 shrink-0'>
          {sections.map(s => (
            <NavItem
              key={s.id}
              icon={s.icon}
              label={s.label}
              active={activeTab === s.id}
              onClick={() => setActiveTab(s.id)}
            />
          ))}
        </nav>

        {/* Content — px-1 so focus rings on flush-left inputs aren't clipped */}
        <div className='flex-1 min-w-0 overflow-y-auto pb-8 px-1'>
          {/* ── General ───────────────────────────────── */}
          {activeTab === 'general' && (
            <div>
              <SectionLabel>Appearance</SectionLabel>
              <div className='grid grid-cols-2 gap-3 py-3'>
                {(
                  [
                    {
                      id: 'default' as const,
                      name: 'Default Dark',
                      sub: 'Neutral grays',
                      icon: Moon,
                      swatches: ['#1a1a1a', '#3a3a3a', '#fafafa', '#6366f1'],
                    },
                    {
                      id: 'palenight' as const,
                      name: 'Palenight',
                      sub: 'Material colors',
                      icon: Palette,
                      swatches: ['#1e2030', '#292D3E', '#C792EA', '#82AAFF'],
                    },
                  ] as const
                ).map(theme => {
                  const isActive =
                    theme.id === 'palenight'
                      ? config.theme === 'palenight'
                      : config.theme !== 'palenight';
                  return (
                    <button
                      key={theme.id}
                      onClick={() => update({ theme: theme.id })}
                      className={`relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all ${
                        isActive
                          ? 'border-primary/60 bg-accent/60 ring-1 ring-primary/20'
                          : 'border-border/60 hover:border-border hover:bg-accent/30'
                      }`}
                    >
                      {isActive && (
                        <div className='absolute top-2.5 right-2.5'>
                          <Check className='h-3.5 w-3.5 text-primary' />
                        </div>
                      )}
                      <div className='flex gap-0.5'>
                        {theme.swatches.map((c, i) => (
                          <span
                            key={i}
                            className='h-8 w-2.5 first:rounded-l-[3px] last:rounded-r-[3px]'
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div>
                        <div className='text-[13px] font-medium'>{theme.name}</div>
                        <div className='text-[11px] text-muted-foreground'>{theme.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Repositories ──────────────────────────── */}
          {activeTab === 'repositories' && (
            <div>
              <SectionLabel>Scanning</SectionLabel>
              <div className='py-3.5'>
                <div className='text-[13px] font-medium text-foreground'>Scan directory</div>
                <div className='text-[12px] text-muted-foreground mt-0.5 mb-2.5'>
                  Root directory to scan for repositories.
                </div>
                <Input
                  value={scanDir}
                  onChange={e => setScanDir(e.target.value)}
                  placeholder='~/Documents/Repos'
                  className='h-8 text-[13px] font-mono'
                />
              </div>

              <Divider />

              <div className='py-3.5'>
                <div className='text-[13px] font-medium text-foreground'>Ignore patterns</div>
                <div className='text-[12px] text-muted-foreground mt-0.5 mb-2.5'>
                  Glob patterns for directories to exclude from the repository list.
                </div>
                <TagList
                  items={ignorePatterns}
                  setItems={setIgnorePatterns}
                  placeholder='e.g. **/ThirdParty/**'
                  mono
                />
              </div>

              <Divider />
              <SectionLabel>Branch protection</SectionLabel>

              <div className='py-3.5'>
                <div className='text-[13px] font-medium text-foreground'>Protected branches</div>
                <div className='text-[12px] text-muted-foreground mt-0.5 mb-2.5'>
                  Branches that can never be deleted via cleanup. The current branch is always
                  protected.
                </div>
                <TagList
                  items={protectedBranches}
                  setItems={setProtectedBranches}
                  placeholder='e.g. release'
                />
              </div>
            </div>
          )}

          {/* ── Code Search ───────────────────────────── */}
          {activeTab === 'search' && (
            <div>
              <SectionLabel>Indexing</SectionLabel>
              <Row
                label='Enable code search'
                description='Index your codebase locally with AI embeddings for natural language search.'
              >
                <Switch checked={codeSearchEnabled} onCheckedChange={setCodeSearchEnabled} />
              </Row>

              <Divider />

              <Row
                label='Max file size'
                description='Files larger than this are skipped during indexing.'
              >
                <NumInput
                  value={codeSearchMaxFileSize}
                  onChange={setCodeSearchMaxFileSize}
                  unit='KB'
                />
              </Row>

              <Divider />
              <SectionLabel>Exclusions</SectionLabel>

              <div className='py-3.5'>
                <div className='text-[13px] font-medium text-foreground'>Exclude patterns</div>
                <div className='text-[12px] text-muted-foreground mt-0.5 mb-2.5'>
                  Glob patterns for files and directories to skip when indexing.
                </div>
                <TagList
                  items={codeSearchExcludePatterns}
                  setItems={setCodeSearchExcludePatterns}
                  placeholder='e.g. **/vendor/**'
                  mono
                />
              </div>
            </div>
          )}

          {/* ── Ports ─────────────────────────────────── */}
          {activeTab === 'ports' && (
            <div>
              <SectionLabel>Monitoring</SectionLabel>
              <Row
                label='Scan interval'
                description='How often to poll for open TCP ports and link them to running processes.'
              >
                <NumInput
                  value={portScanInterval}
                  onChange={setPortScanInterval}
                  unit='seconds'
                />
              </Row>
            </div>
          )}

          {/* ── Scaffolding ───────────────────────────── */}
          {activeTab === 'scaffolding' && (
            <div>
              <SectionLabel>Templates</SectionLabel>
              <div className='py-3.5'>
                <div className='text-[13px] font-medium text-foreground'>
                  Project templates directory
                </div>
                <div className='text-[12px] text-muted-foreground mt-0.5 mb-2.5'>
                  Each subdirectory becomes a template in "New Project".
                </div>
                <Input
                  value={projectTemplatesDir}
                  onChange={e => setProjectTemplatesDir(e.target.value)}
                  placeholder='~/Templates/projects'
                  className='h-8 text-[13px] font-mono'
                />
              </div>

              <Divider />

              <div className='py-3.5'>
                <div className='text-[13px] font-medium text-foreground'>
                  Setup template directory
                </div>
                <div className='text-[12px] text-muted-foreground mt-0.5 mb-2.5'>
                  Config files (eslint, prettier, etc.) copied into new projects after scaffolding.
                </div>
                <Input
                  value={setupTemplateDir}
                  onChange={e => setSetupTemplateDir(e.target.value)}
                  placeholder='~/dotfiles/project-templates'
                  className='h-8 text-[13px] font-mono'
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
