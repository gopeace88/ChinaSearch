# ChinaSearch Gateway

Gateway server for orchestrating headless browser automation with Playwright.

## Architecture

```
Gateway Server
├── Express REST API (port 3001)
├── Session Management (SQLite DB)
└── Playwright Controller (Headless Chrome + Extension)
```

## Key Components

### PlaywrightController (`src/services/playwright-controller.ts`)

Manages headless Chrome instances with the ChinaSearch extension loaded.

**Key Features:**
- Launches Chrome with extension pre-loaded from `/dist/`
- Opens ChatGPT in automated browser
- Sends commands to extension via `chrome.runtime.sendMessage`
- Handles file attachments via Playwright's `setInputFiles` API
- Provides real-time progress monitoring

**Methods:**
- `launch()` - Start browser with extension
- `startResearch(topic, maxRounds, files?)` - Begin research session
- `pause()` - Pause active session
- `resume()` - Resume paused session
- `cancel()` - Cancel and cleanup session
- `getProgress()` - Get current progress data
- `attachFiles(filePaths)` - Attach files to ChatGPT
- `close()` - Close browser instance

**Important Notes:**
- Extension ID is auto-detected from `chrome://extensions/`
- Uses persistent context for session isolation
- Each session gets independent browser instance
- **Headless mode disabled** - Chrome extensions require headed mode

### SessionManager (`src/services/session-manager.ts`)

Manages session lifecycle and database persistence.

**Key Features:**
- Creates and tracks research sessions
- Integrates PlaywrightController for each session
- Handles pause/resume/cancel operations
- Graceful cleanup on shutdown

**Methods:**
- `createSession(data)` - Create session and launch browser
- `pauseSession(id)` - Pause browser automation
- `resumeSession(id)` - Resume browser automation
- `cancelSession(id)` - Cancel and close browser
- `getSessionProgress(id)` - Query browser progress
- `closeSession(id)` - Close specific browser instance
- `cleanup()` - Close all browser instances

## REST API

### Create Session
```http
POST /api/sessions
Content-Type: application/json

{
  "topic": "Research topic",
  "maxRounds": 5,
  "files": ["file1.pdf", "file2.txt"]  // optional
}
```

### Get Session
```http
GET /api/sessions/:id
```

### Get Progress
```http
GET /api/sessions/:id/progress
```

Returns:
```json
{
  "status": "running",
  "currentRound": 2,
  "maxRounds": 5,
  "currentQuestion": "What is...",
  "logs": [
    {
      "timestamp": 1234567890,
      "level": "info",
      "message": "Started research"
    }
  ]
}
```

### Control Session
```http
POST /api/sessions/:id/pause
POST /api/sessions/:id/resume
POST /api/sessions/:id/cancel
```

### Download Report
```http
GET /api/sessions/:id/report
```

## Database Schema

### sessions table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  max_rounds INTEGER NOT NULL,
  status TEXT NOT NULL,  -- 'running' | 'paused' | 'completed' | 'failed'
  current_round INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  final_report TEXT,
  error TEXT
)
```

## File Structure

```
gateway/
├── src/
│   ├── index.ts                           # Express app + graceful shutdown
│   ├── db.ts                              # SQLite initialization
│   ├── types.ts                           # TypeScript interfaces
│   ├── routes/
│   │   └── sessions.ts                    # Session REST endpoints
│   └── services/
│       ├── session-manager.ts             # Session lifecycle
│       └── playwright-controller.ts       # Browser automation
├── data/
│   ├── sessions.db                        # SQLite database
│   └── sessions/
│       └── {session-id}/
│           ├── metadata.json
│           ├── final_report.md
│           └── uploads/                   # Uploaded files
└── .playwright-sessions/
    └── {session-id}/                      # Browser user data
```

## Running the Server

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Development
npm run dev

# Production build
npm run build
npm start
```

## Prerequisites

1. **Extension built:** Extension must be pre-built at `/home/jhkim/00.Projects/ChinaSearch/dist/`
2. **Display server:** Required for headed Chrome (use Xvfb on headless servers)
3. **ChatGPT login:** Manual login required on first run (cookies persist)

## Headless Server Setup

For true headless deployment (Linux server without display):

```bash
# Install Xvfb
sudo apt-get install xvfb

# Run with virtual display
xvfb-run -a npm start
```

Or use environment variable:
```bash
DISPLAY=:99 npm start
```

## Error Handling

- **Extension not found:** Verify `/dist/` directory exists
- **Extension ID not detected:** Wait for extension load (increase timeout)
- **ChatGPT login required:** Use persistent cookies or manual login
- **Browser crash:** Automatic cleanup via graceful shutdown handlers

## Graceful Shutdown

The server handles SIGINT/SIGTERM signals:
1. Closes all active browser instances
2. Saves session states
3. Cleans up temporary files

```javascript
process.on('SIGINT', async () => {
  await sessionManager.cleanup();
  process.exit(0);
});
```

## Development Notes

- Each session gets isolated browser profile in `.playwright-sessions/`
- Extension communicates via `chrome.runtime.sendMessage()`
- File paths must be absolute for `setInputFiles()`
- Browser stays open until session completes or is cancelled
- Multiple concurrent sessions supported (each in separate browser)

## Troubleshooting

### Extension not loading
- Verify `/dist/manifest.json` exists
- Check extension name matches "CS Deep Research"
- Increase wait timeout after `goto('chrome://extensions/')`

### ChatGPT automation fails
- Check for login wall
- Verify DOM selectors for file input
- Monitor browser console logs

### Memory issues
- Limit concurrent sessions
- Implement session timeout/cleanup
- Monitor `.playwright-sessions/` size
