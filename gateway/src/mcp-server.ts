// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3004';

async function gw(path: string, options?: RequestInit): Promise<any> {
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
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
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
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] ChinaSearch MCP server running on stdio');
}

main().catch((err) => {
  console.error('[MCP] Fatal error:', err);
  process.exit(1);
});
