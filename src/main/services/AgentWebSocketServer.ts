import { EventEmitter } from 'events';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export class AgentWebSocketServer extends EventEmitter {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private port = 0;
  private registeredSessions = new Set<string>();
  private connections = new Map<string, WebSocket>();
  private buffers = new Map<string, string>();

  get serverPort(): number {
    return this.port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer();
      this.wss = new WebSocketServer({ noServer: true });

      this.server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://127.0.0.1`);
        const match = url.pathname.match(/^\/ws\/cli\/(.+)$/);

        if (!match) {
          socket.destroy();
          return;
        }

        const sessionId = match[1];
        if (!this.registeredSessions.has(sessionId)) {
          socket.destroy();
          return;
        }

        this.wss!.handleUpgrade(request, socket, head, ws => {
          this.handleConnection(sessionId, ws);
        });
      });

      // Listen on random port, localhost only
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        console.log(`[AgentWS] Server listening on 127.0.0.1:${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  private handleConnection(sessionId: string, ws: WebSocket): void {
    this.connections.set(sessionId, ws);
    this.buffers.set(sessionId, '');
    this.emit('cli-connected', sessionId);

    ws.on('message', (data: Buffer) => {
      const buffer = (this.buffers.get(sessionId) || '') + data.toString();
      const lines = buffer.split('\n');
      // Last element is incomplete line (or empty if buffer ended with \n)
      this.buffers.set(sessionId, lines.pop() || '');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          this.emit('cli-message', sessionId, msg);
        } catch {
          console.warn(`[AgentWS] Failed to parse NDJSON from ${sessionId}:`, line.slice(0, 200));
        }
      }
    });

    ws.on('close', () => {
      this.connections.delete(sessionId);
      this.buffers.delete(sessionId);
      this.emit('cli-disconnected', sessionId);
    });

    ws.on('error', err => {
      console.error(`[AgentWS] Error for session ${sessionId}:`, err.message);
    });
  }

  registerSession(id: string): void {
    this.registeredSessions.add(id);
  }

  unregisterSession(id: string): void {
    this.registeredSessions.delete(id);
    const ws = this.connections.get(id);
    if (ws) {
      ws.close();
      this.connections.delete(id);
    }
    this.buffers.delete(id);
  }

  sendToSession(id: string, msg: Record<string, unknown>): boolean {
    const ws = this.connections.get(id);
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg) + '\n');
    return true;
  }

  isConnected(id: string): boolean {
    const ws = this.connections.get(id);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  stop(): void {
    for (const [id, ws] of this.connections) {
      ws.close();
      this.connections.delete(id);
    }
    this.registeredSessions.clear();
    this.buffers.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.port = 0;
  }
}
