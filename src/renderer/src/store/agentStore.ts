import { create } from 'zustand';
import type { AgentSessionInfo, AgentMessage, ClaudeSessionSummary } from '@/types';

interface AgentState {
  agents: Record<string, AgentSessionInfo>;
  activeAgentId: string | null;
  messages: Record<string, AgentMessage[]>;
  streaming: Record<string, string>;
  showLaunchPanel: boolean;
  sessionHistory: ClaudeSessionSummary[];
  viewingHistorySessionId: string | null;

  addAgent: (agent: AgentSessionInfo) => void;
  updateAgent: (agent: AgentSessionInfo) => void;
  removeAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  appendMessage: (sessionId: string, message: AgentMessage) => void;
  setMessages: (sessionId: string, messages: AgentMessage[]) => void;
  appendStreamChunk: (sessionId: string, delta: string) => void;
  clearStream: (sessionId: string) => void;
  setShowLaunchPanel: (show: boolean) => void;
  setSessionHistory: (sessions: ClaudeSessionSummary[]) => void;
  setViewingHistorySessionId: (id: string | null) => void;
}

export const useAgentStore = create<AgentState>(set => ({
  agents: {},
  activeAgentId: null,
  messages: {},
  streaming: {},
  showLaunchPanel: false,
  sessionHistory: [],
  viewingHistorySessionId: null,

  addAgent: agent =>
    set(state => ({
      agents: { ...state.agents, [agent.id]: agent },
    })),

  updateAgent: agent =>
    set(state => ({
      agents: { ...state.agents, [agent.id]: agent },
    })),

  removeAgent: id =>
    set(state => {
      const { [id]: _, ...rest } = state.agents;
      const { [id]: _msgs, ...restMsgs } = state.messages;
      const { [id]: _stream, ...restStream } = state.streaming;
      return {
        agents: rest,
        messages: restMsgs,
        streaming: restStream,
        activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
      };
    }),

  setActiveAgent: id => set({ activeAgentId: id }),

  appendMessage: (sessionId, message) =>
    set(state => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), message],
      },
    })),

  setMessages: (sessionId, messages) =>
    set(state => ({
      messages: { ...state.messages, [sessionId]: messages },
    })),

  appendStreamChunk: (sessionId, delta) =>
    set(state => ({
      streaming: {
        ...state.streaming,
        [sessionId]: (state.streaming[sessionId] || '') + delta,
      },
    })),

  clearStream: sessionId =>
    set(state => ({
      streaming: { ...state.streaming, [sessionId]: '' },
    })),

  setShowLaunchPanel: show => set({ showLaunchPanel: show }),

  setSessionHistory: sessions => set({ sessionHistory: sessions }),

  setViewingHistorySessionId: id => set({ viewingHistorySessionId: id }),
}));
