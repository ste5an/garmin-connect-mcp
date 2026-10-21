import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import { AuthRequiredError } from './garmin/auth';
import type { GarminClient } from './garmin/client';
import { compact } from './tools/format';
import { tools } from './tools';
import { VERSION } from './version';

const MAX_RESPONSE_CHARS = 60_000;

function toText(data: unknown): string {
  const text = JSON.stringify(compact(data));
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return `${text.slice(0, MAX_RESPONSE_CHARS)}\n[truncated: response was ${text.length} characters. Ask for a shorter period or a narrower query.]`;
}

export function describeError(error: unknown): string {
  if (error instanceof AuthRequiredError) return error.message;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) return 'Garmin rejected the saved login. Run `npx garmin-connect-mcp login` again.';
    if (status === 404) return 'Garmin has no data for that request (404). The date may have no data or your device may not support this metric.';
    if (status === 429) return 'Garmin is rate limiting requests (429). Wait a minute and retry.';
    return `Garmin request failed${status ? ` (${status})` : ''}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function createServer(client: GarminClient): McpServer {
  const server = new McpServer({ name: 'garmin-connect-mcp', version: VERSION });

  for (const tool of tools) {
    const isRead = (tool.mode ?? 'read') === 'read';
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          readOnlyHint: isRead,
          destructiveHint: tool.mode === 'destructive',
          idempotentHint: isRead,
          openWorldHint: true,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          await client.connect();
          const data = await tool.run(args, { client });
          return { content: [{ type: 'text' as const, text: toText(data) }] };
        } catch (error) {
          return { isError: true, content: [{ type: 'text' as const, text: describeError(error) }] };
        }
      },
    );
  }

  return server;
}
