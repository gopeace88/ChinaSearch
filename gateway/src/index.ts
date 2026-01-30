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
        console.log(`[WS] Progress updated for session ${sessionId}:`, progressData.state);
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
