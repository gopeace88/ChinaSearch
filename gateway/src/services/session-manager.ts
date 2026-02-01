import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import db, { sessionsDir } from '../db.js';
import type { SessionRecord, CreateSessionRequest } from '../types.js';
import { PlaywrightController } from './playwright-controller.js';

// Webhook delivery: fire-and-forget HTTP POST
async function sendWebhook(url: string, payload: any): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[Webhook] POST ${url} → ${res.status}`);
  } catch (err) {
    console.warn(`[Webhook] Failed to POST ${url}:`, err);
  }
}

export class SessionManager {
  private controllers: Map<string, PlaywrightController> = new Map();

  async createSession(data: CreateSessionRequest): Promise<SessionRecord> {
    const id = randomUUID();
    const now = Date.now();

    const session: SessionRecord = {
      id,
      topic: data.topic,
      max_rounds: data.maxRounds,
      status: 'running',
      current_round: 0,
      created_at: now,
      updated_at: now,
      webhook_url: data.webhookUrl,
    };

    // Create session directory structure
    const sessionDir = join(sessionsDir, id);
    mkdirSync(sessionDir, { recursive: true });
    mkdirSync(join(sessionDir, 'uploads'), { recursive: true });
    mkdirSync(join(sessionDir, 'reports'), { recursive: true });

    // Save to database
    const stmt = db.prepare(`
      INSERT INTO sessions (id, topic, max_rounds, status, current_round, created_at, updated_at, webhook_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.topic,
      session.max_rounds,
      session.status,
      session.current_round,
      session.created_at,
      session.updated_at,
      session.webhook_url || null
    );

    // Save initial metadata
    const metadata = {
      topic: data.topic,
      maxRounds: data.maxRounds,
      files: data.files || [],
      createdAt: now
    };
    writeFileSync(
      join(sessionDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Launch Playwright controller and start research
    try {
      const controller = new PlaywrightController(session.id);
      await controller.launch();

      // Attach files if provided (convert file names to full paths)
      const filePaths = data.files?.map(f => join(sessionDir, 'uploads', f));

      await controller.startResearch(data.topic, data.maxRounds, filePaths);

      // Store controller instance
      this.controllers.set(session.id, controller);

      console.log(`[SessionManager] Started Playwright controller for session ${session.id}`);
    } catch (error) {
      console.error('[SessionManager] Failed to start Playwright controller:', error);

      // Update session status to failed
      this.updateSessionStatus(session.id, 'failed', String(error));

      throw error;
    }

    return session;
  }

  getSession(id: string): SessionRecord | null {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      topic: row.topic,
      max_rounds: row.max_rounds,
      status: row.status,
      current_round: row.current_round,
      created_at: row.created_at,
      updated_at: row.updated_at,
      final_report: row.final_report || undefined,
      error: row.error || undefined,
      webhook_url: row.webhook_url || undefined
    };
  }

  listSessions(filter?: { status?: string }): SessionRecord[] {
    let query = 'SELECT * FROM sessions';
    const params: any[] = [];

    if (filter?.status) {
      query += ' WHERE status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      topic: row.topic,
      max_rounds: row.max_rounds,
      status: row.status,
      current_round: row.current_round,
      created_at: row.created_at,
      updated_at: row.updated_at,
      final_report: row.final_report || undefined,
      error: row.error || undefined,
      webhook_url: row.webhook_url || undefined
    }));
  }

  updateSessionStatus(id: string, status: SessionRecord['status'], error?: string): void {
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE sessions
      SET status = ?, updated_at = ?, error = ?
      WHERE id = ?
    `);

    stmt.run(status, now, error || null, id);
  }

  saveReport(id: string, report: string): void {
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE sessions
      SET final_report = ?, status = 'completed', updated_at = ?
      WHERE id = ?
    `);

    stmt.run(report, now, id);

    // Also save to file
    const sessionDir = join(sessionsDir, id);
    writeFileSync(join(sessionDir, 'final_report.md'), report);
  }

  updateRound(id: string, round: number): void {
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE sessions
      SET current_round = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(round, now, id);
  }

  async pauseSession(id: string): Promise<void> {
    const controller = this.controllers.get(id);
    if (!controller) {
      throw new Error(`No active controller for session ${id}`);
    }

    await controller.pause();
    this.updateSessionStatus(id, 'paused');
  }

  async resumeSession(id: string): Promise<void> {
    const controller = this.controllers.get(id);
    if (!controller) {
      throw new Error(`No active controller for session ${id}`);
    }

    await controller.resume();
    this.updateSessionStatus(id, 'running');
  }

  async cancelSession(id: string): Promise<void> {
    const controller = this.controllers.get(id);
    if (!controller) {
      throw new Error(`No active controller for session ${id}`);
    }

    await controller.cancel();
    await controller.close();
    this.controllers.delete(id);
    this.updateSessionStatus(id, 'failed', 'Cancelled by user');
  }

  async getSessionProgress(id: string): Promise<any> {
    // Try to get progress from WebSocket connection first
    const { getSessionProgress: getWSProgress } = await import('../index.js');
    const wsProgress = getWSProgress(id);

    if (wsProgress) {
      // Format WebSocket progress data for frontend
      const logs = (wsProgress.progressLog || []).map((l: any) => ({
        timestamp: l.time || Date.now(),
        message: l.detail ? `${l.step} — ${l.detail}` : l.step || l.message || '',
        level: l.level || 'info'
      }));
      const lastLog = logs[logs.length - 1];
      return {
        state: wsProgress.state,
        round: wsProgress.round,
        maxRounds: wsProgress.maxRounds,
        lastUpdatedMs: lastLog?.timestamp || Date.now(),
        logs,
        rounds: wsProgress.analyses?.map((a: any, idx: number) => ({
          round: idx + 1,
          question: a.followUpQuestion || '',
          search_query: '',
          search_results: [],
          analysis: a.claudeAnalysis || '',
          completed: true
        })) || []
      };
    }

    // Fallback: try to get from controller if WebSocket data not available
    const controller = this.controllers.get(id);
    if (controller) {
      return await controller.getProgress();
    }

    // Return empty progress instead of null to avoid frontend errors
    return { state: 'WAITING_RESEARCH', round: 0, maxRounds: 0, lastUpdatedMs: Date.now(), logs: [], rounds: [] };
  }

  async closeSession(id: string): Promise<void> {
    const controller = this.controllers.get(id);
    if (!controller) return;

    try {
      await controller.close();
      this.controllers.delete(id);
    } catch (error) {
      console.error(`[SessionManager] Error closing session ${id}:`, error);
    }
  }

  async cleanup(): Promise<void> {
    console.log('[SessionManager] Cleaning up all sessions...');

    for (const [id, controller] of this.controllers.entries()) {
      try {
        await controller.close();
        this.controllers.delete(id);
      } catch (error) {
        console.error(`[SessionManager] Error cleaning up session ${id}:`, error);
      }
    }
  }

  // File management methods
  listSessionFiles(sessionId: string): string[] {
    const uploadDir = join(sessionsDir, sessionId, 'uploads');
    if (!existsSync(uploadDir)) {
      return [];
    }

    return readdirSync(uploadDir);
  }

  getSessionFilePaths(sessionId: string): string[] {
    const uploadDir = join(sessionsDir, sessionId, 'uploads');
    if (!existsSync(uploadDir)) {
      return [];
    }

    const files = readdirSync(uploadDir);
    return files.map(f => join(uploadDir, f));
  }

  saveSessionReport(sessionId: string, reportType: 'detailed' | 'chatgpt', content: string): void {
    const reportDir = join(sessionsDir, sessionId, 'reports');
    mkdirSync(reportDir, { recursive: true });

    const filename = reportType === 'detailed' ? 'detailed-report.md' : 'chatgpt-final-report.md';
    const filePath = join(reportDir, filename);

    writeFileSync(filePath, content, 'utf-8');

    console.log(`[SessionManager] Saved ${reportType} report for session ${sessionId}`);
  }
}

export const sessionManager = new SessionManager();
