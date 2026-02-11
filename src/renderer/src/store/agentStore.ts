import { create } from 'zustand';
import type { AgentSessionInfo, AgentMessage, PermissionRequest } from '@/types';

interface AgentState {
  agents: Record<string, AgentSessionInfo>;
  activeAgentId: string | null;
  messages: Record<string, AgentMessage[]>;
  pendingPermissions: Record<string, PermissionRequest[]>;
  streaming: Record<string, string>;
  showLaunchPanel: boolean;

  addAgent: (agent: AgentSessionInfo) => void;
  updateAgent: (agent: AgentSessionInfo) => void;
  removeAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  appendMessage: (sessionId: string, message: AgentMessage) => void;
  setMessages: (sessionId: string, messages: AgentMessage[]) => void;
  addPermissionRequest: (sessionId: string, permission: PermissionRequest) => void;
  removePermissionRequest: (sessionId: string, requestId: string) => void;
  setPermissions: (sessionId: string, permissions: PermissionRequest[]) => void;
  appendStreamChunk: (sessionId: string, delta: string) => void;
  clearStream: (sessionId: string) => void;
  setShowLaunchPanel: (show: boolean) => void;
}

export const useAgentStore = create<AgentState>(set => ({
  agents: {},
  activeAgentId: null,
  messages: {},
  pendingPermissions: {},
  streaming: {},
  showLaunchPanel: false,

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
      const { [id]: _perms, ...restPerms } = state.pendingPermissions;
      const { [id]: _stream, ...restStream } = state.streaming;
      return {
        agents: rest,
        messages: restMsgs,
        pendingPermissions: restPerms,
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

  addPermissionRequest: (sessionId, permission) =>
    set(state => ({
      pendingPermissions: {
        ...state.pendingPermissions,
        [sessionId]: [...(state.pendingPermissions[sessionId] || []), permission],
      },
    })),

  removePermissionRequest: (sessionId, requestId) =>
    set(state => ({
      pendingPermissions: {
        ...state.pendingPermissions,
        [sessionId]: (state.pendingPermissions[sessionId] || []).filter(
          p => p.requestId !== requestId,
        ),
      },
    })),

  setPermissions: (sessionId, permissions) =>
    set(state => ({
      pendingPermissions: { ...state.pendingPermissions, [sessionId]: permissions },
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
}));
