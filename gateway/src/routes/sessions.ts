import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import { sessionManager } from '../services/session-manager.js';
import { sessionsDir } from '../db.js';
import type { CreateSessionRequest, SessionResponse, SessionRecord } from '../types.js';

const router = Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.params.id;
    const uploadDir = join(sessionsDir, sessionId, 'uploads');

    // Create directory if it doesn't exist
    mkdirSync(uploadDir, { recursive: true });

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Convert DB record to API response
function toResponse(session: SessionRecord): SessionResponse {
  return {
    id: session.id,
    topic: session.topic,
    maxRounds: session.max_rounds,
    status: session.status,
    currentRound: session.current_round,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    finalReport: session.final_report,
    error: session.error
  };
}

// POST /api/sessions - Create new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateSessionRequest = req.body;

    if (!data.topic || typeof data.topic !== 'string') {
      return res.status(400).json({ error: 'Invalid topic' });
    }

    if (!data.maxRounds || typeof data.maxRounds !== 'number' || data.maxRounds < 1) {
      return res.status(400).json({ error: 'Invalid maxRounds' });
    }

    const session = await sessionManager.createSession(data);
    res.status(201).json(toResponse(session));
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions - List sessions
router.get('/', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const filter = status ? { status } : undefined;

    const sessions = sessionManager.listSessions(filter);
    res.json(sessions.map(toResponse));
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /api/sessions/:id - Get session details
router.get('/:id', (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(toResponse(session));
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// POST /api/sessions/:id/pause - Pause session
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'running') {
      return res.status(400).json({ error: 'Session is not running' });
    }

    await sessionManager.pauseSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Pause session error:', error);
    res.status(500).json({ error: 'Failed to pause session' });
  }
});

// POST /api/sessions/:id/resume - Resume session
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not paused' });
    }

    await sessionManager.resumeSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Resume session error:', error);
    res.status(500).json({ error: 'Failed to resume session' });
  }
});

// POST /api/sessions/:id/cancel - Cancel session
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'completed' || session.status === 'failed') {
      return res.status(400).json({ error: 'Session already finished' });
    }

    await sessionManager.cancelSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

// POST /api/sessions/:id/stop - Stop session (generate final report then stop)
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'completed' || session.status === 'failed') {
      return res.status(400).json({ error: 'Session already finished' });
    }

    // Send STOP_SESSION to extension via WebSocket
    // Extension will generate final report then update status via progress updates
    const { sendToExtension } = await import('../index.js');
    try {
      await sendToExtension({ type: 'STOP_SESSION', payload: { sessionId: req.params.id } });
    } catch (e) {
      // Extension not connected - just mark completed
      sessionManager.updateSessionStatus(req.params.id, 'completed');
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Stop session error:', error);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// GET /api/sessions/:id/progress - Get live progress
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const progress = await sessionManager.getSessionProgress(req.params.id);
    res.json({ ...progress, session: toResponse(session) });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// GET /api/sessions/:id/report - Download final report
router.get('/:id/report', (req: Request, res: Response) => {
  try {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.final_report) {
      return res.status(404).json({ error: 'Report not available' });
    }

    const reportPath = join(sessionsDir, req.params.id, 'final_report.md');
    const report = readFileSync(reportPath, 'utf-8');

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${session.id}_report.md"`);
    res.send(report);
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// POST /api/sessions/:id/files - Upload files to session
router.post('/:id/files', upload.array('files'), async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    res.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload files error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// GET /api/sessions/:id/files - List uploaded files
router.get('/:id/files', (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const uploadDir = join(sessionsDir, sessionId, 'uploads');

    if (!existsSync(uploadDir)) {
      return res.json({ files: [] });
    }

    const files = readdirSync(uploadDir).map(filename => {
      const filePath = join(uploadDir, filename);
      return {
        filename,
        path: filePath
      };
    });

    res.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

export default router;
