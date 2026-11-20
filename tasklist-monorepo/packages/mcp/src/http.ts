import { randomUUID } from 'node:crypto';

import { serve } from '@hono/node-server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';

import type { TaskListRepository } from './repository';
import { createTaskListMcpServer } from './server';

/**
 * MCP over Streamable HTTP（Web Standard）。
 *
 * 会话按 `mcp-session-id` 维护：SDK 的 stateless transport 不能跨请求复用，
 * 因此每个新会话创建独立的 McpServer + transport。
 */

export interface StartMcpHttpOptions {
  repo: TaskListRepository;
  version: string;
  port: number;
  /** 监听地址，默认 127.0.0.1（不要对外暴露）。 */
  hostname?: string;
  name?: string;
}

export interface McpHttpServerHandle {
  port: number;
  close: () => Promise<void>;
}

interface Session {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
}

type HttpServer = ReturnType<typeof serve>;

function listen(
  fetchHandler: (request: Request) => Response | Promise<Response>,
  port: number,
  hostname: string,
): Promise<HttpServer> {
  return new Promise<HttpServer>((resolve, reject) => {
    const server = serve({ fetch: fetchHandler, port, hostname }, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
    server.once('error', reject);
  });
}

/** 启动 MCP HTTP 服务；端口被占用时自动向后寻找（最多 10 次）。 */
export async function startMcpHttpServer(
  options: StartMcpHttpOptions,
): Promise<McpHttpServerHandle> {
  const serverName = options.name ?? 'sylvie-tasklist';
  const hostname = options.hostname ?? '127.0.0.1';
  const sessions = new Map<string, Session>();

  const createSession = (): Session => {
    const server = createTaskListMcpServer({
      repo: options.repo,
      version: options.version,
      name: serverName,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { transport, server });
      },
      onsessionclosed: (sessionId) => {
        sessions.delete(sessionId);
        void server.close().catch(() => undefined);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };
    return { transport, server };
  };

  const app = new Hono();
  app.onError((error, c) => {
    console.error('[mcp] 请求处理失败', error);
    return c.json({ error: error.message }, 500);
  });
  app.get('/health', (c) =>
    c.json({
      ok: true,
      server: serverName,
      version: options.version,
      transport: 'streamable-http',
    }),
  );
  app.all('/mcp', async (c) => {
    const sessionId = c.req.header('mcp-session-id');
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return c.json({ error: 'unknown session' }, 404);
      }
      const response = await session.transport.handleRequest(c.req.raw);
      return response ?? c.body(null, 202);
    }

    const session = createSession();
    await session.server.connect(session.transport);
    const response = await session.transport.handleRequest(c.req.raw);
    return response ?? c.body(null, 202);
  });

  let httpServer: HttpServer | null = null;
  let port = options.port;
  for (let attempt = 0; attempt < 10 && !httpServer; attempt += 1) {
    try {
      httpServer = await listen(app.fetch, port, hostname);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt === 9) {
        throw error;
      }
      port += 1;
    }
  }

  if (!httpServer) {
    throw new Error('MCP Server 启动失败');
  }

  const bound = httpServer;
  return {
    port,
    close: async () => {
      await Promise.all(
        [...sessions.values()].map(async (session) => {
          await session.transport.close().catch(() => undefined);
          await session.server.close().catch(() => undefined);
        }),
      );
      sessions.clear();
      await new Promise<void>((resolve, reject) => {
        bound.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
