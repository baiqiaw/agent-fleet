import { createServer, type Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CodexManager } from './codex.js';
import { DEFAULT_CONFIG, VERSION } from './types.js';
import type { FleetConfig } from './types.js';

export function createMcpServer(config: FleetConfig = DEFAULT_CONFIG) {
  const codex = new CodexManager(config);
  const server = new McpServer({
    name: 'agent-fleet',
    version: VERSION,
  });

  // Tool: codex_run
  server.tool(
    'codex_run',
    'Execute a task using Codex CLI. Returns the task output.',
    {
      prompt: z.string().describe('The task prompt to send to Codex'),
      cwd: z.string().optional().describe('Working directory for the task'),
      model: z.string().optional().describe('Model to use (e.g. o3, o4-mini)'),
      sandbox: z
        .enum(['read-only', 'workspace-write', 'danger-full-access'])
        .optional()
        .describe('Sandbox policy for Codex commands'),
    },
    async (params) => {
      try {
        const task = await codex.run(params.prompt, {
          cwd: params.cwd,
          model: params.model,
          sandbox: params.sandbox,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                taskId: task.id,
                output: task.output.slice(-10000),
                exitCode: task.exitCode,
                state: task.state,
              }),
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: codex_status
  server.tool('codex_status', 'Check the current Codex execution status', {}, async () => {
    const task = codex.task;
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            running: codex.running,
            taskId: task?.id ?? null,
            prompt: task?.prompt?.slice(0, 200) ?? null,
            startTime: task?.startedAt?.toISOString() ?? null,
            tasksCompleted: codex.completed,
          }),
        },
      ],
    };
  });

  // Tool: codex_cancel
  server.tool('codex_cancel', 'Cancel the currently running Codex task', {}, async () => {
    const cancelled = codex.cancel();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ cancelled }),
        },
      ],
    };
  });

  // Tool: fleet_info
  server.tool('fleet_info', 'Get agent-fleet cluster status', {}, async () => {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            uptime: codex.getUptime(),
            tasksCompleted: codex.completed,
            serverVersion: VERSION,
            running: codex.running,
          }),
        },
      ],
    };
  });

  return { server, codex };
}

/** Start as stdio MCP server (for Claude Code auto-spawn) */
export async function startStdioServer(config: FleetConfig = DEFAULT_CONFIG) {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { server } = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

export async function startServer(
  config: FleetConfig = DEFAULT_CONFIG
): Promise<{ httpServer: Server; config: FleetConfig }> {
  const { server } = createMcpServer(config);

  const httpServer = createServer(async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  return new Promise((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(config.port, config.host, () => {
      resolve({ httpServer, config });
    });
  });
}
