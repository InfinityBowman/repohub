import { useCallback } from 'react';
import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgents } from '@/hooks/useAgents';
import { EmptyState } from '@/components/agents/EmptyState';
import { AgentLaunchPanel } from '@/components/agents/AgentLaunchPanel';
import { AgentTerminal } from '@/components/agents/AgentTerminal';
import { InfoBar } from '@/components/agents/InfoBar';
import { MessageInput } from '@/components/agents/MessageInput';
import { PermissionRequestInline } from '@/components/agents/PermissionRequestInline';
import type { AgentLaunchConfig } from '@/types';

export function AgentCommandCenterView() {
  const {
    agents,
    activeAgentId,
    messages,
    pendingPermissions,
    streaming,
    showLaunchPanel,
    setShowLaunchPanel,
    setActiveAgent,
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

  // No agents and no launch panel → empty state
  if (agentList.length === 0 && !showLaunchPanel) {
    return (
      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <h2 className='text-xl font-semibold'>Agents</h2>
          </div>
        </div>
        <EmptyState onLaunch={() => setShowLaunchPanel(true)} />
      </div>
    );
  }

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

  // Active agent view
  return (
    <div className='flex h-full flex-col gap-3'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h2 className='text-xl font-semibold'>Agents</h2>
          {agentList.length > 1 && (
            <div className='flex gap-1'>
              {agentList.map(a => (
                <button
                  key={a.id}
                  onClick={() => setActiveAgent(a.id)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    a.id === activeAgentId
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {a.config.repoName}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button size='sm' variant='outline' onClick={() => setShowLaunchPanel(true)}>
          <Plus className='h-4 w-4' />
          New Agent
        </Button>
      </div>

      {activeAgent ? (
        <>
          <InfoBar agent={activeAgent} onStop={handleStop} />

          {/* Permission requests */}
          {activePermissions.length > 0 && (
            <div className='flex flex-col gap-2'>
              {activePermissions.map(p => (
                <PermissionRequestInline
                  key={p.requestId}
                  permission={p}
                  onRespond={handleRespondPermission}
                />
              ))}
            </div>
          )}

          {/* Terminal */}
          <AgentTerminal messages={activeMessages} streamingText={activeStreaming} />

          {/* Input */}
          <MessageInput agentState={activeAgent.state} onSend={handleSendMessage} />
        </>
      ) : (
        <div className='flex flex-1 items-center justify-center'>
          <div className='text-muted-foreground flex flex-col items-center gap-2'>
            <Bot className='h-8 w-8' />
            <span className='text-sm'>Select an agent or launch a new one</span>
          </div>
        </div>
      )}
    </div>
  );
}
