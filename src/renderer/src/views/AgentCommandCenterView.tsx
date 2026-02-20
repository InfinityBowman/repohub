import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Bot,
  Plus,
  History,
  Clock,
  MessageSquare,
  DollarSign,
  Play,
  ArrowLeft,
  Loader2,
  RefreshCw,
  X,
  Eye,
  AlertCircle,
  FolderOpen,
  ChevronDown,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAgents } from '@/hooks/useAgents';
import { useRepositoryStore } from '@/store/repositoryStore';
import { useAgentStore } from '@/store/agentStore';
import { AgentLaunchPanel } from '@/components/agents/AgentLaunchPanel';
import { AgentTerminal } from '@/components/agents/AgentTerminal';
import { InfoBar } from '@/components/agents/InfoBar';
import { MessageInput } from '@/components/agents/MessageInput';
import type { AgentLaunchConfig, ClaudeProject, ClaudeSessionSummary } from '@/types';

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className='flex shrink-0 items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400'>
      <AlertCircle className='h-4 w-4 shrink-0' />
      {message}
    </div>
  );
}

function SessionRow({
  session,
  onView,
  onResume,
  isActive,
  showProject,
}: {
  session: ClaudeSessionSummary;
  onView: () => void;
  onResume: () => void;
  isActive: boolean;
  showProject?: boolean;
}) {
  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onView}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView();
        }
      }}
      className={`group flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isActive ?
          'border-primary/40 bg-primary/10'
        : 'bg-card border-border hover:border-border/80 hover:bg-accent/60'
      }`}
    >
      <MessageSquare className='mt-0.5 h-4 w-4 shrink-0 text-blue-400' />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{session.task || '(no task)'}</p>
        <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs'>
          {showProject && session.projectDisplayName && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='flex items-center gap-1'>
                  <FolderOpen className='h-3 w-3' />
                  {session.projectDisplayName}
                </span>
              </TooltipTrigger>
              <TooltipContent>{session.projectDecodedPath}</TooltipContent>
            </Tooltip>
          )}
          <span className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            {timeAgo(session.modifiedAt)}
          </span>
          <span className='flex items-center gap-1'>
            <MessageSquare className='h-3 w-3' />
            {session.messageCount} msgs
          </span>
          {session.costUsd > 0 && (
            <span className='flex items-center gap-1'>
              <DollarSign className='h-3 w-3' />${session.costUsd.toFixed(4)}
            </span>
          )}
          <span>{formatDuration(session.durationSeconds)}</span>
        </div>
      </div>
      <Button
        size='sm'
        variant='ghost'
        className='shrink-0 opacity-0 transition-opacity group-hover:opacity-100'
        onClick={e => {
          e.stopPropagation();
          onResume();
        }}
      >
        <Play className='h-3.5 w-3.5' />
        Resume
      </Button>
    </div>
  );
}

function ProjectFilterDropdown({
  projects,
  selected,
  onSelect,
}: {
  projects: ClaudeProject[];
  selected: ClaudeProject | null;
  onSelect: (project: ClaudeProject | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = filter
    ? projects.filter(
        p =>
          p.displayName.toLowerCase().includes(filter.toLowerCase()) ||
          p.decodedPath.toLowerCase().includes(filter.toLowerCase()),
      )
    : projects;

  return (
    <div ref={ref} className='relative flex-1'>
      <button
        onClick={() => setOpen(!open)}
        className='border-border bg-card hover:bg-accent/60 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors'
      >
        <FolderOpen className='text-muted-foreground h-4 w-4 shrink-0' />
        <p className='min-w-0 flex-1 truncate text-sm'>
          {selected ? selected.displayName : 'All projects'}
        </p>
        <ChevronDown className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className='border-border bg-popover absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg'>
          <div className='border-border flex items-center gap-2 border-b px-3 py-2'>
            <Search className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder='Filter projects...'
              className='bg-transparent text-sm outline-none placeholder:text-muted-foreground flex-1'
            />
          </div>
          <div className='max-h-[320px] overflow-y-auto py-1'>
            {/* "All projects" option */}
            <button
              onClick={() => {
                onSelect(null);
                setOpen(false);
                setFilter('');
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                !selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent/60'
              }`}
            >
              <History className='h-4 w-4 shrink-0 text-blue-400' />
              <p className='text-sm font-medium'>All projects</p>
            </button>

            {filtered.length === 0 && filter ?
              <p className='text-muted-foreground px-3 py-4 text-center text-sm'>No projects match</p>
            : filtered.map(project => (
                <button
                  key={project.encodedPath}
                  onClick={() => {
                    onSelect(project);
                    setOpen(false);
                    setFilter('');
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                    selected?.encodedPath === project.encodedPath
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent/60'
                  }`}
                >
                  <FolderOpen className={`h-4 w-4 shrink-0 ${project.isValidPath ? 'text-blue-400' : 'text-muted-foreground'}`} />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{project.displayName}</p>
                    <p className='text-muted-foreground truncate text-xs'>{project.decodedPath}</p>
                  </div>
                  <div className='flex shrink-0 items-center gap-2'>
                    <span className='text-muted-foreground text-xs'>{timeAgo(project.lastActiveAt)}</span>
                    <Badge variant='secondary' className='text-xs'>
                      {project.sessionCount}
                    </Badge>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentCommandCenterView() {
  const {
    agents,
    activeAgentId,
    messages,
    streaming,
    streamingThinking,
    showLaunchPanel,
    claudeProjects,
    sessionHistory,
    viewingHistorySessionId,
    setActiveAgent,
    setShowLaunchPanel,
    setViewingHistorySessionId,
    launch,
    stop,
    sendMessage,
    loadAllProjects,
    loadAllSessions,
    loadSessionHistory,
    viewSession,
    resumeSession,
  } = useAgents();

  const repositories = useRepositoryStore(s => s.repositories);
  const removeAgent = useAgentStore(s => s.removeAgent);

  const [filterProject, setFilterProject] = useState<ClaudeProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const agentList = Object.values(agents);
  const activeAgent = activeAgentId ? agents[activeAgentId] : null;
  const activeMessages = activeAgentId ? messages[activeAgentId] || [] : [];
  const activeStreaming = activeAgentId ? streaming[activeAgentId] || '' : '';
  const activeStreamingThinking = activeAgentId ? streamingThinking[activeAgentId] || '' : '';

  const viewKey = viewingHistorySessionId ? `history:${viewingHistorySessionId}` : null;
  const viewingMessages = viewKey ? messages[viewKey] || [] : [];
  const viewingSession =
    viewingHistorySessionId ?
      sessionHistory.find(s => s.sessionId === viewingHistorySessionId)
    : null;

  // Client-side filter
  const filteredSessions = useMemo(() => {
    if (!filterProject) return sessionHistory;
    return sessionHistory.filter(s => s.projectEncodedPath === filterProject.encodedPath);
  }, [sessionHistory, filterProject]);

  // Load all sessions on first visit only — store persists across tab switches
  useEffect(() => {
    const { sessionHistory, claudeProjects } = useAgentStore.getState();
    if (sessionHistory.length > 0 || claudeProjects.length > 0) return;
    setLoading(true);
    Promise.all([loadAllProjects(), loadAllSessions()]).finally(() => setLoading(false));
  }, [loadAllProjects, loadAllSessions]);

  // Ensure repos are loaded (still needed for launch panel)
  useEffect(() => {
    if (repositories.length === 0) {
      window.electron.repositories.scan().then(repos => {
        useRepositoryStore.getState().setRepositories(repos);
      });
    }
  }, [repositories.length]);

  // --- Handlers ---

  const handleLaunch = useCallback(
    async (config: AgentLaunchConfig) => {
      try {
        await launch(config);
      } catch (err) {
        console.error('Failed to launch agent:', err);
      }
    },
    [launch],
  );

  const handleStop = useCallback(() => {
    if (activeAgentId) stop(activeAgentId);
  }, [activeAgentId, stop]);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (activeAgentId) sendMessage(activeAgentId, content);
    },
    [activeAgentId, sendMessage],
  );

  const handleView = useCallback(
    (session: ClaudeSessionSummary) => {
      const encodedPath = session.projectEncodedPath;
      if (encodedPath) {
        viewSession(encodedPath, session.sessionId);
      }
    },
    [viewSession],
  );

  const handleResume = useCallback(
    async (session: ClaudeSessionSummary) => {
      if (!session.projectEncodedPath || !session.projectIsValidPath) {
        setResumeError('Cannot resume: project directory no longer exists on disk');
        setTimeout(() => setResumeError(null), 5000);
        return;
      }
      setResuming(session.sessionId);
      setResumeError(null);
      try {
        await resumeSession(session.sessionId, {
          repoId: session.projectEncodedPath,
          repoPath: session.projectDecodedPath!,
          repoName: session.projectDisplayName || 'Unknown',
          roleId: 'coder',
          task: session.task,
          autonomous: false,
        });
      } catch (err: any) {
        setResumeError(err?.message || 'Failed to resume session');
        setTimeout(() => setResumeError(null), 5000);
      } finally {
        setResuming(null);
      }
    },
    [resumeSession],
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    Promise.all([loadAllProjects(), loadAllSessions()]).finally(() => setLoading(false));
  }, [loadAllProjects, loadAllSessions]);

  const goToList = useCallback(() => {
    setActiveAgent(null);
    setViewingHistorySessionId(null);
  }, [setActiveAgent, setViewingHistorySessionId]);

  // --- Tabs ---

  const tabs =
    agentList.length > 0 ?
      <div className='flex items-center gap-1'>
        {agentList.map(a => (
          <div key={a.id} className='flex items-center'>
            <button
              onClick={() => {
                setActiveAgent(a.id);
                setViewingHistorySessionId(null);
              }}
              title={a.config.task || a.config.repoName}
              className={`max-w-[160px] truncate rounded px-2 py-0.5 text-xs transition-colors ${
                a.id === activeAgentId && !viewingHistorySessionId ?
                  'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {a.config.task ?
                a.config.task.length > 25 ?
                  a.config.task.slice(0, 25) + '...'
                : a.config.task
              : a.config.repoName}
              {a.state === 'working' && (
                <span className='ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400' />
              )}
            </button>
            {(a.state === 'completed' || a.state === 'error') && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  removeAgent(a.id);
                }}
                className='text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors'
              >
                <X className='h-3 w-3' />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={goToList}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            !activeAgentId && !viewingHistorySessionId ?
              'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className='mr-1 inline h-3 w-3' />
          History
        </button>
      </div>
    : null;

  // --- Header (always the same) ---

  const header = (
    <div className='flex shrink-0 items-center justify-between'>
      <div className='flex items-center gap-3'>
        <h2 className='text-xl font-semibold'>Agents</h2>
        {!showLaunchPanel && tabs}
      </div>
      {showLaunchPanel ?
        <Button size='sm' variant='ghost' onClick={() => setShowLaunchPanel(false)}>
          Cancel
        </Button>
      : <Button size='sm' variant='outline' onClick={() => setShowLaunchPanel(true)}>
          <Plus className='h-4 w-4' />
          New Agent
        </Button>
      }
    </div>
  );

  // ==========================================================================
  // State 1: Launch panel (natural scroll)
  // ==========================================================================

  if (showLaunchPanel) {
    return (
      <div className='flex flex-col gap-4'>
        {header}
        <AgentLaunchPanel onLaunch={handleLaunch} />
      </div>
    );
  }

  // ==========================================================================
  // State 2: Active agent terminal (contained — terminal scrolls internally)
  // ==========================================================================

  if (activeAgent) {
    return (
      <div className='flex h-full flex-col gap-2 overflow-hidden'>
        {header}
        <InfoBar agent={activeAgent} onStop={handleStop} />
        <AgentTerminal
          messages={activeMessages}
          streamingText={activeStreaming}
          streamingThinking={activeStreamingThinking}
        />
        <MessageInput agentState={activeAgent.state} onSend={handleSendMessage} />
      </div>
    );
  }

  // ==========================================================================
  // State 3: Viewing history messages (contained, read-only)
  // ==========================================================================

  if (viewingHistorySessionId && viewingMessages.length > 0) {
    return (
      <div className='flex h-full flex-col gap-2 overflow-hidden'>
        {header}
        <div className='flex shrink-0 items-center gap-3'>
          <Button variant='ghost' size='sm' onClick={goToList}>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>
              {viewingSession?.task || 'Session'}
            </p>
            {viewingSession?.projectDisplayName && (
              <p className='text-muted-foreground truncate text-xs'>
                {viewingSession.projectDisplayName}
              </p>
            )}
          </div>
          <Badge variant='secondary' className='text-muted-foreground gap-1 text-xs'>
            <Eye className='h-3 w-3' />
            Read-only
          </Badge>
          {viewingSession && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={resuming === viewingSession.sessionId || !viewingSession.projectIsValidPath}
                    onClick={() => handleResume(viewingSession)}
                  >
                    {resuming === viewingSession.sessionId ?
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    : <Play className='h-3.5 w-3.5' />}
                    Resume
                  </Button>
                </span>
              </TooltipTrigger>
              {!viewingSession.projectIsValidPath && (
                <TooltipContent>Project directory no longer exists</TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
        {resumeError && <ErrorBanner message={resumeError} />}
        <AgentTerminal messages={viewingMessages} streamingText='' />
      </div>
    );
  }

  // ==========================================================================
  // State 4: Session timeline (natural page scroll)
  // ==========================================================================

  return (
    <div className='flex flex-col gap-4'>
      {header}

      {resumeError && <ErrorBanner message={resumeError} />}

      {/* Project filter + refresh */}
      <div className='flex items-center gap-2'>
        <ProjectFilterDropdown
          projects={claudeProjects}
          selected={filterProject}
          onSelect={setFilterProject}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size='sm'
              variant='ghost'
              disabled={loading}
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Session list */}
      {loading ?
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        </div>
      : filteredSessions.length > 0 ?
        <div className='flex flex-col gap-1.5'>
          {filteredSessions.map(session => (
            <SessionRow
              key={`${session.projectEncodedPath}:${session.sessionId}`}
              session={session}
              isActive={viewingHistorySessionId === session.sessionId}
              showProject={!filterProject}
              onView={() => handleView(session)}
              onResume={() => handleResume(session)}
            />
          ))}
        </div>
      : <div className='flex flex-col items-center gap-3 py-8 text-center'>
          <Bot className='text-muted-foreground h-8 w-8' />
          <div>
            <p className='text-sm font-medium'>No sessions found</p>
            <p className='text-muted-foreground text-xs'>
              {filterProject ?
                'No Claude Code sessions for this project.'
              : 'No Claude Code sessions found. Use Claude Code in a project to create sessions.'}
            </p>
          </div>
        </div>
      }
    </div>
  );
}
