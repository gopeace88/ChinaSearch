# Claude Max API Proxy - Session Management Changes

## Summary
Modified `claude-max-api-proxy` to use clawdbot-style session management with `--resume` instead of `stream-json`.

## Changes Made

### 1. `/subprocess/manager.js` - CLI Invocation

#### Changed `buildArgs()` method:

**Before:**
```javascript
const args = [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model", options.model,
    "--dangerously-skip-permissions",
    prompt,
];
```

**After:**
```javascript
const args = [
    "-p",
    "--output-format", "json",  // Changed from stream-json to json
    "--dangerously-skip-permissions",
];

// Session handling: resume mode vs new session
if (options.resume && options.sessionId) {
    // Resume existing session
    args.push("--resume", options.sessionId);
} else {
    // New session: specify model and session ID
    args.push("--model", options.model);
    if (options.sessionId) {
        args.push("--session-id", options.sessionId);
    }
}

args.push(prompt);
```

#### Changed output parsing:

**Before:** Line-by-line JSON streaming parser that processes each message as it arrives

**After:** Collect all stdout, parse complete JSON on process close:

```javascript
// On stdout data: just append to buffer
this.process.stdout?.on("data", (chunk) => {
    this.buffer += chunk.toString();
});

// On close: parse entire buffer as JSON
this.process.on("close", (code) => {
    if (this.buffer.trim()) {
        try {
            const result = JSON.parse(this.buffer.trim());
            this.emit("result", result);
        } catch (err) {
            this.emit("error", new Error("Failed to parse CLI JSON output"));
        }
    }
    this.emit("close", code);
});
```

### 2. `/server/routes.js` - Session Management Integration

#### Added import:
```javascript
import { sessionManager } from "../session/manager.js";
```

#### Modified `handleChatCompletions()`:

Added session lookup and resume logic:

```javascript
// Handle session management
let subprocessOptions = {
    model: cliInput.model,
};

if (cliInput.sessionId) {
    const existingSession = sessionManager.get(cliInput.sessionId);

    if (existingSession) {
        // Resume existing session
        subprocessOptions = {
            resume: true,
            sessionId: existingSession.claudeSessionId,
        };
    } else {
        // Create new session
        const claudeSessionId = sessionManager.getOrCreate(cliInput.sessionId, cliInput.model);
        subprocessOptions = {
            resume: false,
            sessionId: claudeSessionId,
            model: cliInput.model,
        };
    }
}
```

#### Updated handler signatures:
- `handleStreamingResponse(req, res, subprocess, cliInput, requestId, subprocessOptions)`
- `handleNonStreamingResponse(res, subprocess, cliInput, requestId, subprocessOptions)`

Both now pass `subprocessOptions` to `subprocess.start()` instead of individual parameters.

### 3. `/adapter/cli-to-openai.js` - Include Session ID in Response

Added `session_id` field to the response:

```javascript
export function cliResultToOpenai(result, requestId) {
    return {
        id: `chatcmpl-${requestId}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: normalizeModelName(modelName),
        choices: [...],
        usage: {...},
        session_id: result.session_id,  // NEW: Include session ID from CLI
    };
}
```

## How It Works

### First Request (New Session)
1. Client sends request with `user: "conversation-123"`
2. Proxy extracts sessionId from `cliInput.sessionId` (populated from OpenAI `user` field)
3. SessionManager creates new mapping: `conversation-123 -> <UUID>`
4. Proxy calls: `claude -p --output-format json --model sonnet --session-id <UUID> <prompt>`
5. Response includes `session_id: <UUID>`

### Subsequent Request (Resume Session)
1. Client sends request with same `user: "conversation-123"`
2. Proxy finds existing session: `conversation-123 -> <UUID>`
3. Proxy calls: `claude -p --output-format json --resume <UUID> <prompt>`
4. Response includes same `session_id: <UUID>`

## JSON Output Format

The `--output-format json` returns a complete result object:

```json
{
  "type": "result",
  "subtype": "success",
  "cost_usd": 0.05,
  "duration_ms": 5000,
  "duration_api_ms": 4500,
  "is_error": false,
  "num_turns": 1,
  "result": "The actual response text",
  "session_id": "abc-123-...",
  "total_cost_usd": 0.05,
  "usage": {
    "input_tokens": 100,
    "output_tokens": 200
  }
}
```

## Key Differences from stream-json

| Feature | stream-json (old) | json (new) |
|---------|------------------|------------|
| Output Mode | Line-by-line streaming | Single JSON object |
| Parsing | Parse each line as JSON | Parse complete buffer on close |
| Session Support | No --resume support | Full --resume support |
| Streaming | Content deltas emitted incrementally | Single result event |
| CLI Flags | --verbose, --include-partial-messages | Minimal flags |

## Testing

Run the test script:

```bash
# Start the proxy (if not already running)
claude-max-api-proxy

# In another terminal
node /home/jhkim/00.Projects/ChinaSearch/test-proxy-session.js
```

Expected output:
- First request creates new session
- Second request resumes with same session ID
- Both responses show same `session_id`

## Files Modified

1. `/home/jhkim/.nvm/versions/node/v22.22.0/lib/node_modules/claude-max-api-proxy/dist/subprocess/manager.js`
2. `/home/jhkim/.nvm/versions/node/v22.22.0/lib/node_modules/claude-max-api-proxy/dist/server/routes.js`
3. `/home/jhkim/.nvm/versions/node/v22.22.0/lib/node_modules/claude-max-api-proxy/dist/adapter/cli-to-openai.js`

## Session Storage

Sessions are stored in: `~/.claude-code-cli-sessions.json`

Format:
```json
{
  "conversation-123": {
    "clawdbotId": "conversation-123",
    "claudeSessionId": "abc-123-uuid",
    "createdAt": 1706659200000,
    "lastUsedAt": 1706659200000,
    "model": "sonnet"
  }
}
```

Sessions expire after 24 hours of inactivity.
