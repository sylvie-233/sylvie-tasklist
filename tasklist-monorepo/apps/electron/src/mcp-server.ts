import { randomUUID } from 'node:crypto';

import { serve } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { UNGROUPED, describeDue, normalizeDueInput } from '@sylvie/core';
import type { Priority, Task, TaskData, TaskDraft } from '@sylvie/core';
import { Hono } from 'hono';
import { z } from 'zod';

/**
 * MCP Server：官方 @modelcontextprotocol/sdk + Hono。
 *
 * - 传输层：Streamable HTTP（Web Standard），与 Hono 直接对接；
 * - 会话：按 `mcp-session-id` 维护 transport（SDK 推荐用法，stateless transport 不可跨请求复用）；
 * - 仅监听 127.0.0.1；
 * - 工具：`list_tasks`（查询）、`create_task`（创建）。
 */

export interface McpServerOptions {
  port: number;
  appVersion: string;
  getData: () => TaskData;
  createTask: (draft: TaskDraft) => Task;
}

export interface McpServerHandle {
  port: number;
  close: () => Promise<void>;
}

interface Session {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
}

const SERVER_NAME = 'sylvie-tasklist';

function summarizeTask(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    group: task.group,
    priority: task.priority,
    done: task.done,
    dueAt: task.dueAt || null,
    due: task.dueAt ? describeDue(task.dueAt) : null,
    createdAt: new Date(task.createdAt).toISOString(),
    completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
  };
}

function queryTasks(
  data: TaskData,
  filter: { group?: string; status?: 'all' | 'active' | 'done'; search?: string },
): unknown {
  const keyword = filter.search?.trim().toLowerCase() ?? '';
  let tasks = data.tasks;

  if (filter.group) {
    tasks = tasks.filter((task) => task.group === filter.group);
  }
  if (filter.status === 'active') {
    tasks = tasks.filter((task) => !task.done);
  } else if (filter.status === 'done') {
    tasks = tasks.filter((task) => task.done);
  }
  if (keyword) {
    tasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(keyword) || task.note.toLowerCase().includes(keyword),
    );
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    return (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || a.createdAt - b.createdAt;
  });

  return {
    total: sorted.length,
    groups: [...data.groups, UNGROUPED],
    tasks: sorted.map(summarizeTask),
  };
}

function textResult(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: options.appVersion });

  server.registerTool(
    'list_tasks',
    {
      title: '查询任务',
      description: '查询任务清单，可按分组、完成状态和关键词过滤。',
      inputSchema: {
        group: z.string().optional().describe('分组名；省略表示所有分组'),
        status: z.enum(['all', 'active', 'done']).optional().describe('完成状态过滤，默认 all'),
        search: z.string().optional().describe('标题 / 备注关键词'),
      },
    },
    async ({ group, status, search }) =>
      textResult(queryTasks(options.getData(), { group, status, search })),
  );

  server.registerTool(
    'create_task',
    {
      title: '创建任务',
      description: '创建一条任务，返回创建后的任务对象。',
      inputSchema: {
        title: z.string().min(1).describe('任务标题（必填）'),
        note: z.string().optional().describe('备注'),
        group: z.string().optional().describe('分组名，省略则归入「未分组」'),
        priority: z.enum(['high', 'mid', 'low']).optional().describe('优先级，默认 mid'),
        dueAt: z
          .string()
          .optional()
          .describe('截止时间，格式 YYYY-MM-DDTHH:mm（也接受纯日期 YYYY-MM-DD）'),
      },
    },
    async ({ title, note, group, priority, dueAt }) => {
      const draft: TaskDraft = {
        title: title.trim(),
        note: note ?? '',
        group: group?.trim() || UNGROUPED,
        priority: (priority ?? 'mid') as Priority,
        dueAt: normalizeDueInput(dueAt ?? ''),
      };
      const task = options.createTask(draft);
      return textResult({ created: summarizeTask(task) });
    },
  );

  return server;
}

type HttpServer = ReturnType<typeof serve>;

function listen(
  fetchHandler: (request: Request) => Response | Promise<Response>,
  port: number,
): Promise<HttpServer> {
  return new Promise<HttpServer>((resolve, reject) => {
    const server = serve({ fetch: fetchHandler, port, hostname: '127.0.0.1' }, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
    server.once('error', reject);
  });
}

/** 启动 MCP Server；端口被占用时自动向后寻找。 */
export async function startMcpServer(options: McpServerOptions): Promise<McpServerHandle> {
  const sessions = new Map<string, Session>();

  const createSession = (): Session => {
    const server = createMcpServer(options);
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
      server: SERVER_NAME,
      version: options.appVersion,
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
      httpServer = await listen(app.fetch, port);
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
