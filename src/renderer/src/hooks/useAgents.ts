import { useEffect, useCallback } from 'react';
import { useAgentStore } from '@/store/agentStore';
import type { AgentLaunchConfig } from '@/types';

// Module-level counter for StrictMode double-mount protection
let activeListeners = 0;
let cleanupFns: (() => void)[] = [];

export function useAgentListeners() {
  useEffect(() => {
    activeListeners++;

    if (activeListeners === 1) {
      // Initial fetch
      window.electron.agent.list().then(agents => {
        for (const agent of agents) {
          useAgentStore.getState().addAgent(agent);
        }
      });

      const unsubLaunched = window.electron.on.agentLaunched(data => {
        useAgentStore.getState().addAgent(data);
      });

      const unsubStatus = window.electron.on.agentStatusChanged(data => {
        useAgentStore.getState().updateAgent(data);
      });

      const unsubOutput = window.electron.on.agentOutput(data => {
        useAgentStore.getState().clearStream(data.sessionId);
        useAgentStore.getState().appendMessage(data.sessionId, data.message);
      });

      const unsubPermission = window.electron.on.agentPermissionRequest(data => {
        useAgentStore.getState().addPermissionRequest(data.sessionId, data.permission);
      });

      const unsubResult = window.electron.on.agentResult(data => {
        const agent = useAgentStore.getState().agents[data.sessionId];
        if (agent) {
          useAgentStore.getState().updateAgent({ ...agent, cost: data.cost });
        }
      });

      const unsubStream = window.electron.on.agentStream(data => {
        if (data.delta === '') {
          useAgentStore.getState().clearStream(data.sessionId);
        } else {
          useAgentStore.getState().appendStreamChunk(data.sessionId, data.delta);
        }
      });

      const unsubError = window.electron.on.agentError(data => {
        const agent = useAgentStore.getState().agents[data.sessionId];
        if (agent) {
          useAgentStore.getState().updateAgent({ ...agent, state: 'error' });
        }
      });

      cleanupFns = [
        unsubLaunched,
        unsubStatus,
        unsubOutput,
        unsubPermission,
        unsubResult,
        unsubStream,
        unsubError,
      ];
    }

    return () => {
      activeListeners--;
      if (activeListeners === 0) {
        for (const fn of cleanupFns) fn();
        cleanupFns = [];
      }
    };
  }, []);
}

export function useAgents() {
  const store = useAgentStore();

  const launch = useCallback(async (config: AgentLaunchConfig) => {
    const result = await window.electron.agent.launch(config);
    useAgentStore.getState().setActiveAgent(result.sessionId);
    useAgentStore.getState().setShowLaunchPanel(false);
    return result;
  }, []);

  const stop = useCallback(async (sessionId: string) => {
    return window.electron.agent.stop(sessionId);
  }, []);

  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    return window.electron.agent.sendMessage(sessionId, content);
  }, []);

  const respondPermission = useCallback(
    async (sessionId: string, requestId: string, allow: boolean) => {
      useAgentStore.getState().removePermissionRequest(sessionId, requestId);
      return window.electron.agent.respondPermission(sessionId, requestId, allow);
    },
    [],
  );

  return {
    agents: store.agents,
    activeAgentId: store.activeAgentId,
    messages: store.messages,
    pendingPermissions: store.pendingPermissions,
    streaming: store.streaming,
    showLaunchPanel: store.showLaunchPanel,
    setActiveAgent: store.setActiveAgent,
    setShowLaunchPanel: store.setShowLaunchPanel,
    launch,
    stop,
    sendMessage,
    respondPermission,
  };
}
