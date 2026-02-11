import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAgents } from '@/hooks/useAgents';
import { useRepositoryStore } from '@/store/repositoryStore';
import { useAgentStore } from '@/store/agentStore';
import { AgentLaunchPanel } from '@/components/agents/AgentLaunchPanel';
import { AgentTerminal } from '@/components/agents/AgentTerminal';
import { InfoBar } from '@/components/agents/InfoBar';
import { MessageInput } from '@/components/agents/MessageInput';
import type { AgentLaunchConfig, ClaudeSessionSummary } from '@/types';

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
}: {
  session: ClaudeSessionSummary;
  onView: () => void;
  onResume: () => void;
  isActive: boolean;
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
          'border-primary/40 bg-primary/5'
        : 'border-border hover:border-border/80 hover:bg-secondary/30'
      }`}
    >
      <MessageSquare className='mt-0.5 h-4 w-4 shrink-0 text-blue-400' />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{session.task || '(no task)'}</p>
        <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs'>
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

export function AgentCommandCenterView() {
  const {
    agents,
    activeAgentId,
    messages,
    streaming,
    streamingThinking,
    showLaunchPanel,
    sessionHistory,
    viewingHistorySessionId,
    setActiveAgent,
    setShowLaunchPanel,
    setViewingHistorySessionId,
    launch,
    stop,
    sendMessage,
    loadSessionHistory,
    viewSession,
    resumeSession,
  } = useAgents();

  const repositories = useRepositoryStore(s => s.repositories);
  const removeAgent = useAgentStore(s => s.removeAgent);

  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
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

  const selectedRepo = repositories.find(r => r.path === selectedRepoPath);

  // Ensure repos are loaded
  useEffect(() => {
    if (repositories.length === 0) {
      window.electron.repositories.scan().then(repos => {
        useRepositoryStore.getState().setRepositories(repos);
      });
    }
  }, [repositories.length]);

  // Auto-select first repo
  useEffect(() => {
    if (repositories.length > 0 && !selectedRepoPath) {
      setSelectedRepoPath(repositories[0].path);
    }
  }, [repositories, selectedRepoPath]);

  // Load sessions when repo changes
  useEffect(() => {
    if (selectedRepoPath) {
      setLoading(true);
      loadSessionHistory(selectedRepoPath).finally(() => setLoading(false));
    }
  }, [selectedRepoPath, loadSessionHistory]);

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
    (sessionId: string) => {
      if (selectedRepoPath) viewSession(selectedRepoPath, sessionId);
    },
    [selectedRepoPath, viewSession],
  );

  const handleResume = useCallback(
    async (session: ClaudeSessionSummary) => {
      if (!selectedRepo) return;
      setResuming(session.sessionId);
      setResumeError(null);
      try {
        await resumeSession(session.sessionId, {
          repoId: selectedRepo.id,
          repoPath: selectedRepo.path,
          repoName: selectedRepo.name,
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
    [selectedRepo, resumeSession],
  );

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
          <p className='min-w-0 flex-1 truncate text-sm font-medium'>
            {viewingSession?.task || 'Session'}
          </p>
          <Badge variant='secondary' className='text-muted-foreground gap-1 text-xs'>
            <Eye className='h-3 w-3' />
            Read-only
          </Badge>
          {viewingSession && (
            <Button
              size='sm'
              variant='outline'
              disabled={resuming === viewingSession.sessionId}
              onClick={() => handleResume(viewingSession)}
            >
              {resuming === viewingSession.sessionId ?
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              : <Play className='h-3.5 w-3.5' />}
              Resume
            </Button>
          )}
        </div>
        {resumeError && <ErrorBanner message={resumeError} />}
        <AgentTerminal messages={viewingMessages} streamingText='' />
      </div>
    );
  }

  // ==========================================================================
  // State 4: Session list (natural page scroll)
  // ==========================================================================

  return (
    <div className='flex flex-col gap-4'>
      {header}

      {/* Resume error */}
      {resumeError && <ErrorBanner message={resumeError} />}

      {/* Repo selector + refresh */}
      {repositories.length > 0 && (
        <div className='flex items-center gap-2'>
          <Select value={selectedRepoPath} onValueChange={setSelectedRepoPath}>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select a repository' />
            </SelectTrigger>
            <SelectContent>
              {repositories
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(repo => (
                  <SelectItem key={repo.id} value={repo.path}>
                    {repo.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size='sm'
            variant='ghost'
            disabled={loading || !selectedRepoPath}
            onClick={() => {
              if (selectedRepoPath) {
                setLoading(true);
                loadSessionHistory(selectedRepoPath).finally(() => setLoading(false));
              }
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      {/* Session list */}
      {loading ?
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        </div>
      : sessionHistory.length > 0 ?
        <div className='flex flex-col gap-1.5'>
          {sessionHistory.map(session => (
            <SessionRow
              key={session.sessionId}
              session={session}
              isActive={viewingHistorySessionId === session.sessionId}
              onView={() => handleView(session.sessionId)}
              onResume={() => handleResume(session)}
            />
          ))}
        </div>
      : <div className='flex flex-col items-center gap-3 py-8 text-center'>
          <Bot className='text-muted-foreground h-8 w-8' />
          <div>
            <p className='text-sm font-medium'>No sessions found</p>
            <p className='text-muted-foreground text-xs'>
              {selectedRepoPath ?
                'No Claude Code sessions exist for this repository yet.'
              : 'Select a repository to browse session history.'}
            </p>
          </div>
        </div>
      }
    </div>
  );
}
