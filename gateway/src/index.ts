import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import sessionsRouter from './routes/sessions.js';
import { sessionManager } from './services/session-manager.js';

const app = express();
const PORT = process.env.PORT || 3004;
const httpServer = createServer(app);

// WebSocket server for Extension communication
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Store connected extensions and session progress
const extensionClients = new Set<WebSocket>();
const sessionProgress = new Map<string, any>(); // sessionId -> progress data

wss.on('connection', (ws) => {
  console.log('[WS] Extension connected');
  extensionClients.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WS] Received from extension:', message.type);

      // Handle messages from extension (e.g., status updates)
      if (message.type === 'EXTENSION_READY') {
        ws.send(JSON.stringify({ type: 'ACK', payload: { ready: true } }));
      } else if (message.type === 'PROGRESS_UPDATE') {
        // Store progress for this session
        const { sessionId, ...progressData } = message.payload;
        sessionProgress.set(sessionId, progressData);
        console.log(`[WS] Progress updated for session ${sessionId}: state=${progressData.state} finalReport=${progressData.finalReport ? progressData.finalReport.length + ' chars' : 'null'}`);

        // Sync Extension state to DB
        if (progressData.state === 'IDLE') {
          const dbSession = sessionManager.getSession(sessionId);
          if (dbSession && dbSession.status === 'running') {
            if (progressData.finalReport) {
              sessionManager.saveReport(sessionId, progressData.finalReport);
              console.log(`[WS] Session ${sessionId} completed with final report`);
            } else {
              sessionManager.updateSessionStatus(sessionId, 'completed');
              console.log(`[WS] Session ${sessionId} completed`);
            }
          }
        }
        // Update round number in DB
        if (progressData.round) {
          sessionManager.updateRound(sessionId, progressData.round);
        }

        // Fire webhook if registered for this session
        const session = sessionManager.getSession(sessionId);
        if (session?.webhook_url) {
          const logs = (progressData.progressLog || []).map((l: any) => ({
            timestamp: l.time || Date.now(),
            message: l.detail ? `${l.step} — ${l.detail}` : l.step || l.message || '',
            level: l.level || 'info'
          }));
          const lastLog = logs[logs.length - 1];
          const webhookPayload = {
            event: 'progress_update',
            sessionId,
            state: progressData.state,
            round: progressData.round,
            maxRounds: progressData.maxRounds,
            lastUpdatedMs: lastLog?.timestamp || Date.now(),
            latestLog: lastLog || null,
            session: {
              id: session.id,
              topic: session.topic,
              maxRounds: session.max_rounds,
              status: session.status,
              currentRound: session.current_round,
            }
          };
          // Fire-and-forget
          fetch(session.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
            signal: AbortSignal.timeout(5000),
          }).then(res => {
            console.log(`[Webhook] POST ${session.webhook_url} → ${res.status}`);
          }).catch(err => {
            console.warn(`[Webhook] Failed:`, err.message);
          });
        }
      }
    } catch (error) {
      console.error('[WS] Error handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Extension disconnected');
    extensionClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error);
  });
});

// Export function to get session progress
export function getSessionProgress(sessionId: string): any {
  return sessionProgress.get(sessionId) || null;
}

// Export function to send commands to extension
export function sendToExtension(command: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (extensionClients.size === 0) {
      reject(new Error('No extension connected'));
      return;
    }

    const client = Array.from(extensionClients)[0];

    const messageId = Date.now().toString();
    const message = { ...command, messageId };

    const timeout = setTimeout(() => {
      reject(new Error('Extension response timeout'));
    }, 10000);

    const responseHandler = (data: any) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.messageId === messageId) {
          clearTimeout(timeout);
          client.off('message', responseHandler);
          resolve(response);
        }
      } catch (error) {
        // Ignore parse errors for other messages
      }
    };

    client.on('message', responseHandler);
    client.send(JSON.stringify(message));
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/sessions', sessionsRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, cleaning up...');
  await sessionManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, cleaning up...');
  await sessionManager.cleanup();
  process.exit(0);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Gateway server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
