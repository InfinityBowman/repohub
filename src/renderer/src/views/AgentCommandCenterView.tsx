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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/hooks/useAgents';
import { useRepositoryStore } from '@/store/repositoryStore';
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

function SessionHistoryRow({
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
    <button
      onClick={onView}
      className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
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
    </button>
  );
}

function SessionHistory({
  onLaunch,
  setShowLaunchPanel,
}: {
  onLaunch: () => void;
  setShowLaunchPanel: (show: boolean) => void;
}) {
  const repositories = useRepositoryStore(s => s.repositories);
  const {
    sessionHistory,
    viewingHistorySessionId,
    messages,
    loadSessionHistory,
    viewSession,
    resumeSession,
    setViewingHistorySessionId,
  } = useAgents();

  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);

  // Ensure repos are loaded (store may be empty if user hasn't visited Repositories tab)
  useEffect(() => {
    if (repositories.length === 0) {
      window.electron.repositories.scan().then(repos => {
        useRepositoryStore.getState().setRepositories(repos);
      });
    }
  }, [repositories.length]);

  // Auto-select first repo on mount
  useEffect(() => {
    if (repositories.length > 0 && !selectedRepoPath) {
      setSelectedRepoPath(repositories[0].path);
    }
  }, [repositories, selectedRepoPath]);

  // Load session history when repo changes
  useEffect(() => {
    if (selectedRepoPath) {
      setLoading(true);
      loadSessionHistory(selectedRepoPath).finally(() => setLoading(false));
    }
  }, [selectedRepoPath, loadSessionHistory]);

  const selectedRepo = repositories.find(r => r.path === selectedRepoPath);

  const handleView = useCallback(
    (sessionId: string) => {
      if (selectedRepoPath) {
        viewSession(selectedRepoPath, sessionId);
      }
    },
    [selectedRepoPath, viewSession],
  );

  const handleResume = useCallback(
    async (session: ClaudeSessionSummary) => {
      if (!selectedRepo) return;
      setResuming(session.sessionId);
      try {
        await resumeSession(session.sessionId, {
          repoId: selectedRepo.id,
          repoPath: selectedRepo.path,
          repoName: selectedRepo.name,
          roleId: 'coder',
          task: session.task,
          autonomous: false,
        });
      } catch (err) {
        console.error('Failed to resume session:', err);
      } finally {
        setResuming(null);
      }
    },
    [selectedRepo, resumeSession],
  );

  const viewKey = viewingHistorySessionId ? `history:${viewingHistorySessionId}` : null;
  const viewingMessages = viewKey ? messages[viewKey] || [] : [];

  // If viewing a session's messages, show the terminal view
  if (viewingHistorySessionId && viewingMessages.length > 0) {
    const session = sessionHistory.find(s => s.sessionId === viewingHistorySessionId);
    return (
      <div className='flex h-full flex-col gap-3'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='sm' onClick={() => setViewingHistorySessionId(null)}>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <h3 className='min-w-0 flex-1 truncate text-sm font-medium'>
            {session?.task || 'Session History'}
          </h3>
          {session && (
            <Button
              size='sm'
              variant='outline'
              disabled={resuming === session.sessionId}
              onClick={() => handleResume(session)}
            >
              {resuming === session.sessionId ?
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              : <Play className='h-3.5 w-3.5' />}
              Resume
            </Button>
          )}
        </div>
        <div className='via-border/40 h-px bg-gradient-to-r from-transparent to-transparent' />
        <AgentTerminal messages={viewingMessages} streamingText='' />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Header with actions */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <History className='text-muted-foreground h-5 w-5' />
          <h3 className='text-lg font-semibold'>Recent Sessions</h3>
        </div>
        <div className='flex gap-2'>
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
          <Button size='sm' onClick={onLaunch}>
            <Plus className='h-4 w-4' />
            New Agent
          </Button>
        </div>
      </div>

      {/* Repo selector */}
      {repositories.length > 0 && (
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
      )}

      {/* Session list */}
      {loading ?
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        </div>
      : sessionHistory.length > 0 ?
        <div className='flex flex-col gap-1.5'>
          {sessionHistory.map(session => (
            <SessionHistoryRow
              key={session.sessionId}
              session={session}
              isActive={viewingHistorySessionId === session.sessionId}
              onView={() => handleView(session.sessionId)}
              onResume={() => handleResume(session)}
            />
          ))}
        </div>
      : <div className='flex flex-col items-center gap-3 py-12 text-center'>
          <Bot className='text-muted-foreground h-8 w-8' />
          <div>
            <p className='text-sm font-medium'>No sessions found</p>
            <p className='text-muted-foreground text-xs'>
              {selectedRepoPath ?
                'No Claude Code sessions exist for this repository yet.'
              : 'Select a repository to browse session history.'}
            </p>
          </div>
          <Button size='sm' onClick={onLaunch}>
            <Plus className='h-4 w-4' />
            Launch Agent
          </Button>
        </div>
      }
    </div>
  );
}

export function AgentCommandCenterView() {
  const {
    agents,
    activeAgentId,
    messages,
    pendingPermissions,
    streaming,
    showLaunchPanel,
    viewingHistorySessionId,
    setShowLaunchPanel,
    setActiveAgent,
    setViewingHistorySessionId,
    launch,
    stop,
    sendMessage,
    respondPermission,
  } = useAgents();

  const agentList = Object.values(agents);
  const activeAgent = activeAgentId ? agents[activeAgentId] : null;
  const activeMessages = activeAgentId ? messages[activeAgentId] || [] : [];
  const activePermissions = activeAgentId ? pendingPermissions[activeAgentId] || [] : [];
  const activeStreaming = activeAgentId ? streaming[activeAgentId] || '' : '';

  const handleLaunch = useCallback(
    async (config: AgentLaunchConfig) => {
      try {
        await launch(config);
      } catch (err: any) {
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

  const handleRespondPermission = useCallback(
    (requestId: string, allow: boolean) => {
      if (activeAgentId) respondPermission(activeAgentId, requestId, allow);
    },
    [activeAgentId, respondPermission],
  );

  // Launch panel open
  if (showLaunchPanel) {
    return (
      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <h2 className='text-xl font-semibold'>Agents</h2>
          </div>
        </div>
        <AgentLaunchPanel onLaunch={handleLaunch} onCancel={() => setShowLaunchPanel(false)} />
      </div>
    );
  }

  // No active agents → show session history (which includes empty state + launch button)
  if (agentList.length === 0) {
    return (
      <div className='flex h-full flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <h2 className='text-xl font-semibold'>Agents</h2>
          </div>
        </div>
        <SessionHistory
          onLaunch={() => setShowLaunchPanel(true)}
          setShowLaunchPanel={setShowLaunchPanel}
        />
      </div>
    );
  }

  // Active agent view
  return (
    <div className='flex h-full flex-col gap-3'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h2 className='text-xl font-semibold'>Agents</h2>
          {agentList.length > 0 && (
            <div className='flex gap-1'>
              {agentList.map(a => (
                <button
                  key={a.id}
                  onClick={() => {
                    setActiveAgent(a.id);
                    setViewingHistorySessionId(null);
                  }}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    a.id === activeAgentId && !viewingHistorySessionId ?
                      'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {a.config.repoName}
                </button>
              ))}
              <button
                onClick={() => {
                  setActiveAgent(null);
                  setViewingHistorySessionId(null);
                }}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  !activeAgentId && !viewingHistorySessionId ?
                    'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <History className='inline h-3 w-3' /> History
              </button>
            </div>
          )}
        </div>
        <Button size='sm' variant='outline' onClick={() => setShowLaunchPanel(true)}>
          <Plus className='h-4 w-4' />
          New Agent
        </Button>
      </div>

      {/* Show history view when no agent selected */}
      {!activeAgent && !viewingHistorySessionId ?
        <SessionHistory
          onLaunch={() => setShowLaunchPanel(true)}
          setShowLaunchPanel={setShowLaunchPanel}
        />
      : activeAgent ?
        <>
          <InfoBar agent={activeAgent} onStop={handleStop} />

          {/* Gradient divider */}
          <div className='via-border/40 h-px bg-gradient-to-r from-transparent to-transparent' />

          {/* Terminal with inline permissions */}
          <AgentTerminal
            messages={activeMessages}
            streamingText={activeStreaming}
            permissions={activePermissions}
            onRespondPermission={handleRespondPermission}
          />

          {/* Input */}
          <MessageInput agentState={activeAgent.state} onSend={handleSendMessage} />
        </>
        // Viewing history session with active agents in tabs
      : <SessionHistory
          onLaunch={() => setShowLaunchPanel(true)}
          setShowLaunchPanel={setShowLaunchPanel}
        />
      }
    </div>
  );
}
