import { useEffect, useCallback } from 'react';
import { useAgentStore } from '@/store/agentStore';
import type { AgentLaunchConfig } from '@/types';

export function useAgentListeners() {
  useEffect(() => {
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

    const unsubStreamThinking = window.electron.on.agentStreamThinking(data => {
      if (data.delta === '') {
        useAgentStore.getState().clearStreamThinking(data.sessionId);
      } else {
        useAgentStore.getState().appendStreamThinkingChunk(data.sessionId, data.delta);
      }
    });

    const unsubError = window.electron.on.agentError(data => {
      const agent = useAgentStore.getState().agents[data.sessionId];
      if (agent) {
        useAgentStore.getState().updateAgent({ ...agent, state: 'error' });
      }
      useAgentStore.getState().clearStream(data.sessionId);
      useAgentStore.getState().clearStreamThinking(data.sessionId);
    });

    return () => {
      unsubLaunched();
      unsubStatus();
      unsubOutput();
      unsubResult();
      unsubStream();
      unsubStreamThinking();
      unsubError();
    };
  }, []);
}

export function useAgents() {
  const agents = useAgentStore(s => s.agents);
  const activeAgentId = useAgentStore(s => s.activeAgentId);
  const messages = useAgentStore(s => s.messages);
  const streaming = useAgentStore(s => s.streaming);
  const streamingThinking = useAgentStore(s => s.streamingThinking);
  const showLaunchPanel = useAgentStore(s => s.showLaunchPanel);
  const claudeProjects = useAgentStore(s => s.claudeProjects);
  const sessionHistory = useAgentStore(s => s.sessionHistory);
  const viewingHistorySessionId = useAgentStore(s => s.viewingHistorySessionId);
  const setActiveAgent = useAgentStore(s => s.setActiveAgent);
  const setShowLaunchPanel = useAgentStore(s => s.setShowLaunchPanel);
  const setViewingHistorySessionId = useAgentStore(s => s.setViewingHistorySessionId);

  const launch = useCallback(async (config: AgentLaunchConfig) => {
    const result = await window.electron.agent.launch(config);
    useAgentStore.setState({
      activeAgentId: result.sessionId,
      showLaunchPanel: false,
      viewingHistorySessionId: null,
    });
    return result;
  }, []);

  const stop = useCallback(async (sessionId: string) => {
    return window.electron.agent.stop(sessionId);
  }, []);

  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    return window.electron.agent.sendMessage(sessionId, content);
  }, []);

  const loadAllProjects = useCallback(async () => {
    try {
      const projects = await window.electron.agent.listAllProjects();
      useAgentStore.getState().setClaudeProjects(projects);
    } catch (err) {
      console.error('Failed to load Claude projects:', err);
      useAgentStore.getState().setClaudeProjects([]);
    }
  }, []);

  const loadAllSessions = useCallback(async () => {
    try {
      const sessions = await window.electron.agent.listAllSessions();
      useAgentStore.getState().setSessionHistory(sessions);
    } catch (err) {
      console.error('Failed to load all sessions:', err);
      useAgentStore.getState().setSessionHistory([]);
    }
  }, []);

  const loadSessionHistory = useCallback(async (pathOrEncoded: string) => {
    try {
      const sessions = await window.electron.agent.listSessions(pathOrEncoded);
      useAgentStore.getState().setSessionHistory(sessions);
    } catch (err) {
      console.error('Failed to load session history:', err);
      useAgentStore.getState().setSessionHistory([]);
    }
  }, []);

  const viewSession = useCallback(async (pathOrEncoded: string, sessionId: string) => {
    try {
      const messages = await window.electron.agent.readSession(pathOrEncoded, sessionId);
      // Store messages under the history session ID and mark as viewing
      const viewKey = `history:${sessionId}`;
      useAgentStore.getState().setMessages(viewKey, messages);
      useAgentStore.setState({ viewingHistorySessionId: sessionId, activeAgentId: null });
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }, []);

  const resumeSession = useCallback(async (cliSessionId: string, config: AgentLaunchConfig) => {
    // Load historical messages before spawning so the UI shows the full conversation
    const historyMessages = await window.electron.agent.readSession(config.repoPath, cliSessionId);

    const result = await window.electron.agent.resumeSession(cliSessionId, config);

    // Prepopulate the agent's message store with session history
    if (historyMessages.length > 0) {
      useAgentStore.getState().setMessages(result.sessionId, historyMessages);
    }

    useAgentStore.setState({
      activeAgentId: result.sessionId,
      showLaunchPanel: false,
      viewingHistorySessionId: null,
    });
    return result;
  }, []);

  return {
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
  };
}
