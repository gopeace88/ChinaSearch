import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'gateway.db');
const db: Database.Database = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    max_rounds INTEGER NOT NULL,
    status TEXT NOT NULL,
    current_round INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    final_report TEXT,
    error TEXT
  );
`);

// Add webhook_url column if not exists (migration)
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN webhook_url TEXT`);
} catch {
  // Column already exists
}

// Ensure sessions directory exists
const sessionsDir = join(__dirname, '..', 'sessions');
mkdirSync(sessionsDir, { recursive: true });

export default db;
export { sessionsDir };
