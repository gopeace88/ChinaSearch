# MCP Server Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gateway에 MCP Server를 내장하여 OpenClaw 등 MCP 클라이언트가 리서치 세션을 제어할 수 있게 한다.

**Architecture:** `@modelcontextprotocol/sdk`의 `McpServer` + `StdioServerTransport`를 사용. Gateway 프로세스 시작 시 `--mcp` 플래그가 있으면 stdio MCP 모드로, 없으면 기존 HTTP+WebSocket 모드로 실행. MCP 도구들은 기존 `sessionManager`와 `sendToExtension`을 직접 호출.

**Tech Stack:** `@modelcontextprotocol/sdk`, `zod@3`

---

### Task 1: Install MCP SDK dependency

**Files:**
- Modify: `gateway/package.json`

**Step 1: Install dependencies**

Run: `cd /home/nvme1/jhkim/00.Projects/ChinaSearch/gateway && npm install @modelcontextprotocol/sdk zod@3`

**Step 2: Verify installation**

Run: `cd /home/nvme1/jhkim/00.Projects/ChinaSearch/gateway && node -e "require('@modelcontextprotocol/sdk')"`
Expected: No error

**Step 3: Commit**

```bash
git add gateway/package.json gateway/package-lock.json
git commit -m "chore: add MCP SDK dependency"
```

---

### Task 2: Create MCP server entry point

**Files:**
- Create: `gateway/src/mcp-server.ts`

**Step 1: Create the MCP server file**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sessionManager } from './services/session-manager.js';
import { getSessionProgress, sendToExtension } from './index.js';

const server = new McpServer({
  name: 'china-search',
  version: '1.0.0',
});

// Tool: start_session
server.tool(
  'start_session',
  'Start a new ChinaSearch research session. Returns session ID.',
  {
    topic: z.string().describe('Research topic'),
    rounds: z.number().min(1).max(20).default(3).describe('Number of research rounds'),
  },
  async ({ topic, rounds }) => {
    try {
      const session = await sessionManager.createSession({ topic, maxRounds: rounds });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessionId: session.id,
            topic: session.topic,
            maxRounds: session.max_rounds,
            status: session.status,
          }),
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_status
server.tool(
  'get_status',
  'Get current status and progress of a research session.',
  {
    sessionId: z.string().describe('Session ID'),
  },
  async ({ sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Session not found' }],
        isError: true,
      };
    }
    const progress = await sessionManager.getSessionProgress(sessionId);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          id: session.id,
          topic: session.topic,
          status: session.status,
          currentRound: session.current_round,
          maxRounds: session.max_rounds,
          state: progress?.state,
          logs: progress?.logs?.slice(-5) || [],
          rounds: progress?.rounds || [],
        }, null, 2),
      }],
    };
  }
);

// Tool: list_sessions
server.tool(
  'list_sessions',
  'List all research sessions, optionally filtered by status.',
  {
    status: z.enum(['running', 'paused', 'completed', 'failed']).optional().describe('Filter by status'),
  },
  async ({ status }) => {
    const filter = status ? { status } : undefined;
    const sessions = sessionManager.listSessions(filter);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(sessions.map(s => ({
          id: s.id,
          topic: s.topic,
          status: s.status,
          currentRound: s.current_round,
          maxRounds: s.max_rounds,
          createdAt: new Date(s.created_at).toISOString(),
        })), null, 2),
      }],
    };
  }
);

// Tool: cancel_session
server.tool(
  'cancel_session',
  'Cancel a running research session.',
  {
    sessionId: z.string().describe('Session ID to cancel'),
  },
  async ({ sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Session not found' }],
        isError: true,
      };
    }
    if (session.status === 'completed' || session.status === 'failed') {
      return {
        content: [{ type: 'text' as const, text: 'Error: Session already finished' }],
        isError: true,
      };
    }
    try {
      await sessionManager.cancelSession(sessionId);
      return {
        content: [{ type: 'text' as const, text: `Session ${sessionId} cancelled.` }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_report
server.tool(
  'get_report',
  'Get the final report of a completed research session.',
  {
    sessionId: z.string().describe('Session ID'),
  },
  async ({ sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Session not found' }],
        isError: true,
      };
    }
    if (!session.final_report) {
      return {
        content: [{ type: 'text' as const, text: 'Report not available yet. Session status: ' + session.status }],
      };
    }
    return {
      content: [{ type: 'text' as const, text: session.final_report }],
    };
  }
);

// Start MCP server
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] ChinaSearch MCP server started on stdio');
}
```

**Step 2: Commit**

```bash
git add gateway/src/mcp-server.ts
git commit -m "feat: add MCP server with session tools"
```

---

### Task 3: Add MCP mode to Gateway entry point

**Files:**
- Modify: `gateway/src/index.ts`

**Step 1: Add MCP startup flag**

Gateway의 `index.ts` 하단에 MCP 모드 분기를 추가. `--mcp` 인자가 있으면 HTTP 서버 대신 stdio MCP 서버만 시작.

기존 `httpServer.listen()` 블록을 조건부로 변경:

```typescript
// At the bottom of index.ts, replace the httpServer.listen() block:

const isMcpMode = process.argv.includes('--mcp');

if (isMcpMode) {
  // MCP mode: stdio only, no HTTP server
  import('./mcp-server.js').then(({ startMcpServer }) => {
    startMcpServer();
  });
} else {
  // Normal mode: HTTP + WebSocket server
  httpServer.listen(PORT, () => {
    console.log(`Gateway server listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  });
}
```

**주의:** MCP stdio 모드에서는 `console.log`가 stdout을 오염시키므로, MCP 모드에서는 로깅을 `console.error`로 변경하거나 억제해야 함. 단, `mcp-server.ts` 내에서는 이미 `console.error` 사용.

**문제:** MCP 모드에서 `sessionManager`가 `sendToExtension`을 쓰는데, HTTP/WS 서버가 없으면 Extension 연결이 안 됨. → MCP는 세션 조회/생성 명령만 Gateway로 보내는 역할. **실제 실행은 별도로 돌고 있는 Gateway HTTP 프로세스가 담당.** 따라서 MCP 서버는 독립 프로세스로 분리하되, DB와 REST API를 통해 통신하는 게 맞음.

**설계 변경:** MCP 서버를 Gateway 내장이 아니라 **별도 진입점(`mcp-server.ts`)으로 만들되, Gateway REST API를 호출**하는 thin client로 구현. 이렇게 하면:
- Gateway(HTTP+WS)는 항상 실행 중
- MCP 서버는 OpenClaw가 필요할 때 stdio로 실행
- MCP 도구들은 `http://localhost:3004/api/sessions/*`를 호출

**Step 1 (재설계): mcp-server.ts를 REST 클라이언트로 변경**

```typescript
// gateway/src/mcp-server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3004';

async function gw(path: string, options?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

const server = new McpServer({
  name: 'china-search',
  version: '1.0.0',
});

server.tool(
  'start_session',
  'Start a new ChinaSearch research session. Returns session ID.',
  {
    topic: z.string().describe('Research topic'),
    rounds: z.number().min(1).max(20).default(3).describe('Number of research rounds'),
  },
  async ({ topic, rounds }) => {
    try {
      const data = await gw('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ topic, maxRounds: rounds }),
      });
      if (data.error) throw new Error(data.error);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_status',
  'Get current status and progress of a research session.',
  { sessionId: z.string().describe('Session ID') },
  async ({ sessionId }) => {
    try {
      const [session, progress] = await Promise.all([
        gw(`/api/sessions/${sessionId}`),
        gw(`/api/sessions/${sessionId}/progress`),
      ]);
      if (session.error) throw new Error(session.error);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            ...session,
            state: progress?.state,
            logs: progress?.logs?.slice(-5) || [],
            roundDetails: progress?.rounds || [],
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'list_sessions',
  'List all research sessions, optionally filtered by status.',
  {
    status: z.enum(['running', 'paused', 'completed', 'failed']).optional().describe('Filter by status'),
  },
  async ({ status }) => {
    const query = status ? `?status=${status}` : '';
    const data = await gw(`/api/sessions${query}`);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

server.tool(
  'cancel_session',
  'Cancel a running research session.',
  { sessionId: z.string().describe('Session ID to cancel') },
  async ({ sessionId }) => {
    try {
      const data = await gw(`/api/sessions/${sessionId}/cancel`, { method: 'POST' });
      if (data.error) throw new Error(data.error);
      return {
        content: [{ type: 'text' as const, text: `Session ${sessionId} cancelled.` }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_report',
  'Get the final report of a completed research session.',
  { sessionId: z.string().describe('Session ID') },
  async ({ sessionId }) => {
    try {
      const session = await gw(`/api/sessions/${sessionId}`);
      if (session.error) throw new Error(session.error);
      if (!session.finalReport) {
        return {
          content: [{ type: 'text' as const, text: `Report not available. Status: ${session.status}` }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: session.finalReport }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Main
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] ChinaSearch MCP server running on stdio');
}

main().catch((err) => {
  console.error('[MCP] Fatal error:', err);
  process.exit(1);
});
```

**Step 2: Add build script for MCP server**

`gateway/package.json` scripts에 추가:
```json
"mcp": "node dist/mcp-server.js"
```

**Step 3: Commit**

```bash
git add gateway/src/mcp-server.ts gateway/package.json
git commit -m "feat: MCP server as REST client to Gateway"
```

---

### Task 4: Build and test MCP server

**Step 1: Build TypeScript**

Run: `cd /home/nvme1/jhkim/00.Projects/ChinaSearch/gateway && npx tsc`
Expected: No errors

**Step 2: Verify MCP server starts**

Run: `cd /home/nvme1/jhkim/00.Projects/ChinaSearch/gateway && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/mcp-server.js 2>/dev/null | head -1`

Expected: JSON response with server capabilities

**Step 3: Verify tool listing**

After initialize, send `tools/list` request and verify all 5 tools are listed.

**Step 4: Commit**

```bash
git commit -m "test: verify MCP server builds and starts"
```

---

### Task 5: Create OpenClaw MCP configuration

**Files:**
- Create: `docs/mcp-setup.md`

**Step 1: Write setup documentation**

```markdown
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

- Gateway must be running: `systemctl --user start china-search-gateway`
- Chrome Extension must be loaded and connected

## Available Tools

| Tool | Description |
|------|-------------|
| `start_session` | Start research (topic, rounds) |
| `get_status` | Get session status and progress |
| `list_sessions` | List all sessions |
| `cancel_session` | Cancel a running session |
| `get_report` | Get final report |
```

**Step 2: Commit**

```bash
git add docs/mcp-setup.md
git commit -m "docs: MCP server setup guide"
```

---

### Task 6: Final integration commit

**Step 1: Verify everything builds**

Run: `cd /home/nvme1/jhkim/00.Projects/ChinaSearch/gateway && npx tsc`

**Step 2: Push to GitHub**

```bash
git push origin master
```
