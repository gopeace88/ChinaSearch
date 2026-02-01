# ChinaSearch MCP Server Setup

## OpenClaw Configuration

Add to OpenClaw MCP settings:

```json
{
  "mcpServers": {
    "china-search": {
      "command": "node",
      "args": ["/home/nvme1/jhkim/00.Projects/ChinaSearch/gateway/dist/mcp-server.js"],
      "env": {
        "GATEWAY_URL": "http://localhost:3004"
      }
    }
  }
}
```

## Claude Code Configuration

Add to `~/.claude/settings.json` or project `.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "china-search": {
      "command": "node",
      "args": ["/home/nvme1/jhkim/00.Projects/ChinaSearch/gateway/dist/mcp-server.js"]
    }
  }
}
```

## Prerequisites

- Gateway must be running on port 3004
- Chrome Extension must be loaded and connected to Gateway

## Available Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `start_session` | `topic` (string), `rounds` (number, default 3) | Start a new research session |
| `get_status` | `sessionId` (string) | Get session status and progress |
| `list_sessions` | `status` (optional: running/paused/completed/failed) | List all sessions |
| `cancel_session` | `sessionId` (string) | Cancel a running session |
| `get_report` | `sessionId` (string) | Get final report of completed session |
