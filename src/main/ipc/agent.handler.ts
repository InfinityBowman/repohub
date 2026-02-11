import { ipcMain, BrowserWindow } from 'electron';
import type { AgentService } from '../services/AgentService';
import type { ClaudeSessionReader } from '../services/ClaudeSessionReader';
import type { AgentLaunchConfig } from '../types/agent.types';

export function registerAgentHandlers(
  agentService: AgentService,
  claudeSessionReader: ClaudeSessionReader,
): void {
  ipcMain.handle('agent:launch', async (_event, config: AgentLaunchConfig) => {
    return agentService.launchAgent(config);
  });

  ipcMain.handle('agent:stop', async (_event, sessionId: string) => {
    await agentService.stopAgent(sessionId);
    return { success: true };
  });

  ipcMain.handle(
    'agent:send-message',
    async (_event, { sessionId, content }: { sessionId: string; content: string }) => {
      agentService.sendMessage(sessionId, content);
      return { success: true };
    },
  );

  ipcMain.handle(
    'agent:respond-permission',
    async (
      _event,
      { sessionId, requestId, allow }: { sessionId: string; requestId: string; allow: boolean },
    ) => {
      agentService.respondPermission(sessionId, requestId, allow);
      return { success: true };
    },
  );

  ipcMain.handle('agent:list', async () => {
    return agentService.getAllAgents();
  });

  ipcMain.handle('agent:get-messages', async (_event, sessionId: string) => {
    return agentService.getMessages(sessionId);
  });

  ipcMain.handle('agent:get-permissions', async (_event, sessionId: string) => {
    return agentService.getPendingPermissions(sessionId);
  });

  // Session history: list sessions from Claude's native JSONL files
  ipcMain.handle('agent:list-sessions', async (_event, repoPath: string) => {
    return claudeSessionReader.listSessions(repoPath);
  });

  // Session history: read full session messages
  ipcMain.handle(
    'agent:read-session',
    async (_event, { repoPath, sessionId }: { repoPath: string; sessionId: string }) => {
      return claudeSessionReader.readSessionMessages(repoPath, sessionId);
    },
  );

  // Session resume: spawn claude --resume with existing CLI session ID
  ipcMain.handle(
    'agent:resume-session',
    async (
      _event,
      { cliSessionId, config }: { cliSessionId: string; config: AgentLaunchConfig },
    ) => {
      return agentService.resumeSession(cliSessionId, config);
    },
  );

  // Forward service events to renderer
  const events = [
    'agent:launched',
    'agent:status-changed',
    'agent:output',
    'agent:permission-request',
    'agent:result',
    'agent:stream',
    'agent:error',
  ];

  for (const event of events) {
    agentService.on(event, (data: any) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(event, data);
      }
    });
  }
}
