# CLI Command Comparison

## Before (stream-json mode)

```bash
claude --print \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --model sonnet \
  --dangerously-skip-permissions \
  "Your prompt here"
```

**Output:** Line-by-line JSON stream with content deltas
```json
{"type":"content_delta","delta":{"text":"Hello"}}
{"type":"content_delta","delta":{"text":" world"}}
{"type":"assistant","message":{"model":"claude-sonnet-4-5",...}}
{"type":"result","result":"Hello world",...}
```

## After (JSON mode with session support)

### First Request (New Session)
```bash
claude -p \
  --output-format json \
  --dangerously-skip-permissions \
  --model sonnet \
  --session-id abc-123-uuid \
  "Your prompt here"
```

### Resume Request (Existing Session)
```bash
claude -p \
  --output-format json \
  --dangerously-skip-permissions \
  --resume abc-123-uuid \
  "Your follow-up prompt"
```

**Output:** Single JSON object on completion
```json
{
  "type": "result",
  "subtype": "success",
  "cost_usd": 0.05,
  "duration_ms": 5000,
  "duration_api_ms": 4500,
  "is_error": false,
  "num_turns": 1,
  "result": "The complete response text",
  "session_id": "abc-123-uuid",
  "total_cost_usd": 0.05,
  "usage": {
    "input_tokens": 100,
    "output_tokens": 200
  }
}
```

## Key Differences

| Aspect | Before (stream-json) | After (json) |
|--------|---------------------|--------------|
| **Output Format** | Line-by-line streaming | Single complete JSON |
| **Flags** | `--verbose --include-partial-messages` | Minimal flags |
| **Session Resume** | Not supported | `--resume <session-id>` |
| **Session ID** | Not used | `--session-id <uuid>` (first call) |
| **Model Flag** | Always included | Only on first call (not with --resume) |
| **Parsing** | Parse each line | Parse complete output on close |
| **Incremental Updates** | Yes (content deltas) | No (complete response only) |

## Session Flow Example

```bash
# Request 1: Create session
claude -p --output-format json --model sonnet --session-id abc-123 "Hello"
# Returns: {"session_id": "abc-123", "result": "Hi there!", ...}

# Request 2: Resume session (model not needed - already set)
claude -p --output-format json --resume abc-123 "What's 2+2?"
# Returns: {"session_id": "abc-123", "result": "4", ...}

# Request 3: Continue session
claude -p --output-format json --resume abc-123 "Thanks!"
# Returns: {"session_id": "abc-123", "result": "You're welcome!", ...}
```

## Advantages of New Approach

1. **Session Continuity**: Full conversation context across requests
2. **Simplified Parsing**: No line-by-line stream handling needed
3. **Session ID Tracking**: Every response includes session_id for tracking
4. **Cleaner Code**: Less complex buffer/parsing logic
5. **Clawdbot Compatible**: Matches clawdbot's session management pattern

## Trade-offs

**Lost:**
- Incremental streaming updates (no content deltas)
- Real-time progress feedback

**Gained:**
- Session persistence and resume capability
- Simpler, more reliable parsing
- Better error handling (complete JSON or nothing)
- Session ID in every response
