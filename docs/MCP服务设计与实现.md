# MCP 服务设计与实现

> 面向实现的设计文档：架构分层、仓库契约、13 个工具的语义、生命周期与扩展方式。
> 代码位置：协议层 [`packages/mcp`](../tasklist-monorepo/packages/mcp)，宿主适配 [`apps/electron/src/main/mcp`](../tasklist-monorepo/apps/electron/src/main/mcp)。

## 1. 目标与取舍

MCP（Model Context Protocol）Server 让 AI 客户端（Claude Desktop、各类 Agent、脚本）直接读写本机任务清单。
设计上遵循四条约束：

1. **只在本机**：仅监听 `127.0.0.1`，不对外暴露，数据不出本机。
2. **与宿主解耦**：协议层不依赖 Electron，只声明 `TaskListRepository` 端口，便于在 CLI、测试替身中复用。
3. **开关即时生效**：不做“改完重启”，开启即拉起，关闭即释放端口。
4. **语义稳定**：工具粒度对齐用户心智（完成状态、移动位置单独成工具），入参用 zod 校验，错误可读。

明确不做：批量删除/批量迁移、写配置文件、读写任意文件系统路径。MCP 只能操作任务与分组。

## 2. 总体架构

```text
MCP Client (Claude Desktop / Agent / curl)
   │  POST /mcp  (Streamable HTTP, JSON 响应)
   ▼
Hono  app (packages/mcp/src/http.ts)
   │  GET /health  → 探活
   │  ALL /mcp     → 按 mcp-session-id 找会话
   ▼
WebStandardStreamableHTTPServerTransport   ← 每会话一个
   ▼
McpServer (官方 SDK)  ── registerTool ──► 13 个工具
   ▼
TaskListRepository（端口，packages/mcp/src/repository.ts）
   ▼
Electron 适配器（apps/electron/src/main/mcp/repository.ts）
   ▼
主进程内存缓存 → writeJsonAtomic(tasks.json) → broadcast 渲染层
```

| 层   | 位置                                       | 职责                                              | 依赖                             |
| ---- | ------------------------------------------ | ------------------------------------------------- | -------------------------------- |
| 传输 | `http.ts`                                  | Hono 路由、会话表、端口绑定、优雅关闭             | Hono、@hono/node-server、MCP SDK |
| 协议 | `server.ts`                                | 创建 `McpServer`、注册全部工具、注入 instructions | MCP SDK                          |
| 工具 | `tools/*.ts`                               | zod 入参、过滤与格式化、调用仓库                  | `@sylvie/core`、`@sylvie/utils`  |
| 端口 | `repository.ts`                            | 声明语义，不关心存储                              | `@sylvie/core` 类型              |
| 适配 | `apps/electron/src/main/mcp/repository.ts` | 校验业务规则、更新缓存、落盘、广播                | 主进程 `context` / `storage`     |

`packages/mcp` 的 `exports` 直指 `src/index.ts`，由 Vite alias 或 tsx 直接消费，无独立构建产物。

## 3. 传输与会话

使用官方 SDK 的 **Streamable HTTP**（Web Standard 变体），`enableJsonResponse: true` 返回普通 JSON，
便于 curl 调试与非流式客户端。

### 3.1 为什么每个会话独立实例

SDK 的 stateless transport **不能跨请求复用**（会抛 “Stateless transport cannot be reused across requests”）。
因此会话表里存的是「一个 `McpServer` + 一个 transport」：

```ts
const sessions = new Map<string, { transport; server }>();
// 新请求无 session id → 创建会话 → server.connect(transport) → handleRequest
// 有 session id → 查表 → transport.handleRequest
```

- `sessionIdGenerator: randomUUID`，会话 id 通过响应头 `mcp-session-id` 返回。
- `onsessioninitialized` 写入会话表；`onsessionclosed` 与 `transport.onclose` 负责清理并 `server.close()`。
- 未知 session id 返回 `404 { error: 'unknown session' }`，客户端应重新 `initialize`。
- `handleRequest` 返回 `undefined` 时（如通知类消息）回 `202`。

### 3.2 路由

| 方法 | 路径      | 说明                                                                            |
| ---- | --------- | ------------------------------------------------------------------------------- |
| GET  | `/health` | `{ ok, server, version, transport: 'streamable-http' }`，用于探活与实际端口确认 |
| ALL  | `/mcp`    | MCP 主端点；无 session 头则新建会话                                             |
| —    | 其他      | Hono 默认 404                                                                   |

`onError` 统一记录日志并返回 `500 { error }`。

### 3.3 端口与监听

- 默认端口 **37821**，被占用时自动 +1 重试，最多 10 次（37821–37830）。
- 实际端口写回 `McpHttpServerHandle.port`，主进程通过 `McpStatus.port` 暴露给设置页与状态栏。
- `hostname` 默认 `127.0.0.1`，调用方不应改成 `0.0.0.0`。

### 3.4 关闭

`close()` 依次关闭全部会话（transport → server），清空会话表，再关闭 HTTP server。
主进程在 `before-quit` 触发关闭（不阻塞退出），正常情况下不会残留端口。

## 4. 仓库端口契约

```ts
export interface TaskListRepository {
  getData(): TaskData;
  getSettings(): AppSettings;

  createTask(input: CreateTaskInput): Task;
  updateTask(id: number, input: UpdateTaskInput): Task;
  setTaskDone(id: number, done: boolean): Task;
  deleteTask(id: number): void;
  moveTask(id: number, input: MoveTaskInput): Task;

  createGroup(name: string, color?: string): GroupSummary;
  updateGroup(name: string, patch: { name?: string; color?: string | null }): GroupSummary;
  deleteGroup(name: string): number;
}
```

约定：

- **错误即异常**：任务不存在、分组重名、颜色非法等直接 `throw new Error(可读消息)`，
  工具层不 catch，由 SDK 包装为 `isError: true` 的工具结果返回给客户端。
- **写操作必须提交**：实现方在修改后负责持久化与变更通知，协议层不感知存储细节。
- **只描述语义**：端口不定义 DTO 的序列化格式，`Task` 直接使用 `@sylvie/core` 的类型。

## 5. 工具设计

### 5.1 设计原则

1. **读写分离**：5 个查询工具标注 `readOnlyHint`，客户端可据此免确认执行。
2. **状态单独成工具**：`update_task` 不处理完成状态，完成/取消一律走 `set_task_done`，
   由宿主维护 `completedAt`，避免调用方拼字段。
3. **位置用相对语义**：`move_task` 用 `beforeId` / `afterId` 表达“放到谁前面/后面”，
   内部用中点插值算 `order`，调用方不需要理解排序数值。
4. **破坏性操作显式标注**：`delete_task`、`delete_group` 带 `destructiveHint: true`；
   但删除分组**不删除任务**，任务归入「未分组」并返回迁移条数。
5. **返回结构稳定**：所有工具返回单个 `text` part，内容是格式化的 JSON（见 5.3）。

### 5.2 工具清单

**查询（5）**

| 工具           | 入参                                                                                                                                                                           | 行为                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `list_tasks`   | `group?`、`status?`(all/active/done)、`priority?`、`search?`、`overdue?`、`dueBefore?`、`dueAfter?`、`sort?`(priority/due/created/custom，默认 due)、`limit?`(1–500，默认 100) | 复用 `viewTasks` 完成分组/状态/关键词过滤与排序，再叠加优先级、截止区间、逾期过滤；返回 `{ total, returned, tasks }` |
| `get_task`     | `id`                                                                                                                                                                           | 返回单任务摘要，不存在则报错                                                                                         |
| `get_overview` | `group?`、`upcomingLimit?`(1–20，默认 5)                                                                                                                                       | 汇总 total / active / done / overdue，按分组分布（含「未分组」）、最近到期任务、逾期任务（最多 10 条）               |
| `list_groups`  | —                                                                                                                                                                              | 全部分组 + 「未分组」，含颜色与 total/active/done                                                                    |
| `get_settings` | —                                                                                                                                                                              | 返回完整 `settings.json`（只读）                                                                                     |

> `overdue: false` 会把没有截止时间的未完成任务也视为“未逾期”返回；`dueBefore` / `dueAfter`
> 无法解析时忽略该条件。

**任务写（5）**

| 工具            | 入参                                                     | 行为                                                                                                                                 |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `create_task`   | `title`(必填)、`note?`、`group?`、`priority?`、`dueAt?`  | 分组缺省用 `task.defaultGroup`；优先级默认 `mid`；`order` 取 `nextNewOrder`（自定义排序置顶）；`dueAt` 经 `normalizeDueInput` 规范化 |
| `update_task`   | `id`、`title?`、`note?`、`group?`、`priority?`、`dueAt?` | 只改传入字段；`dueAt: ""` 清空截止时间；不改完成状态                                                                                 |
| `set_task_done` | `id`、`done`                                             | 幂等；完成时写 `completedAt = Date.now()`，取消时置 `null`                                                                           |
| `delete_task`   | `id`                                                     | 物理删除，不可恢复                                                                                                                   |
| `move_task`     | `id`、`group?`、`beforeId?`、`afterId?`                  | 可同时改分组与顺序；`beforeId`/`afterId` 互斥；相对自己移动或目标不存在则报错                                                        |

**分组写（3）**

| 工具           | 入参                         | 行为                                                                                           |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `create_group` | `name`、`color?`(#RRGGBB)    | 拒绝与「全部」「未分组」重名或已存在的分组；颜色可选                                           |
| `update_group` | `name`、`newName?`、`color?` | 改名同步迁移该组任务、颜色记录与 `task.defaultGroup`；`color: ""` 清除颜色，不传则保持         |
| `delete_group` | `name`                       | 任务归入「未分组」，删除颜色记录，`task.defaultGroup` 指向该组时回退为「未分组」；返回迁移条数 |

### 5.3 返回格式

```ts
function textResult(payload: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}
```

任务摘要固定字段：`id / title / note / group / priority / done / dueAt / due / createdAt / completedAt`。

- 时间戳一律转为 ISO 8601（`createdAt`、`completedAt`），`completedAt` 未完成时为 `null`；
- `dueAt` 原始值保留（空串转 `null`），另附 `due` 为 `describeDue` 的结果
  （`{ text, overdue, hasTime }`），让模型不必自己判断“今天截止/已逾期”。

### 5.4 instructions

`server.ts` 在创建 `McpServer` 时注入一段 instructions，向模型说明能力边界与两条易错约定：
删除分组不删任务、完成状态用 `set_task_done`。这段文字会随 `initialize` 返回，属于契约的一部分，
新增工具时应同步更新。

## 6. 宿主实现（Electron）

### 6.1 提交链路

```ts
commitTasks(next)  →  state.tasks = next → persistTasks(next) → broadcast('tasks:changed', next)
commitSettings(next) → state.settings = next → persistSettings(next) → broadcast('settings:changed', next)
```

- 以**内存缓存为准**：工具读写都走 `state.tasks` / `state.settings`，避免每次调用读盘；
- 落盘异步且失败只记日志，不阻塞工具返回（写失败属于宿主问题，不应伪装成工具错误）；
- 广播让渲染层立即刷新，界面与 MCP 看到同一份数据。

### 6.2 业务规则落点

| 操作       | 关键实现                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 创建任务   | `id = seq`、`seq + 1`；`order = nextNewOrder(tasks)`；分组用 `ensureGroup` 校验（允许「未分组」） |
| 更新任务   | 字段级 patch；标题 trim 后不可为空；`dueAt` 走 `normalizeDueInput`（纯日期补 `T09:00`）           |
| 完成状态   | 状态相同直接返回，不写盘（幂等）                                                                  |
| 移动任务   | `orderForPosition(tasks, id, targetId, 'before' \| 'after')`，只写被移动任务的 `order`            |
| 创建分组   | 名称去空格、拒绝保留名与重名；颜色 `parseColor` 校验并转小写                                      |
| 重命名分组 | groups / groupColors / tasks[].group 三处同步；默认分组联动写 settings                            |
| 删除分组   | 任务迁到 `UNGROUPED`、清颜色、默认分组回退，返回迁移条数                                          |

`normalizeDueInput` 对非法时间返回空串，因此传错格式的 `dueAt` 会被**静默清空**而不是报错
（与界面输入行为一致）。客户端应传 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm`。

### 6.3 一致性

- 主进程单线程事件循环 + “先改缓存再落盘”，同一时刻只有一个写者，不存在并发覆盖；
- 渲染层落盘有 300/200ms 防抖且跳过内容未变的写入，MCP 写入广播回来的数据不会再次写盘；
- 退出时先 `closeMcpServer()`，避免端口与句柄遗留。

## 7. 生命周期与状态

```text
应用启动
  └─ settings['mcp.serverEnabled'] === true ?
        └─ applyMcpEnabled(true) → startMcpHttpServer → pushMcpStatus

设置页开关（Switch）
  └─ mcp:set-enabled → 写 settings.json → applyMcpEnabled → pushMcpStatus

设置页保存 / 导入配置
  └─ storage:save-settings → applyMcpEnabled(新值) → pushMcpStatus

退出
  └─ before-quit → closeMcpServer()
```

- `applyMcpEnabled(true)` **幂等**：已有实例时直接返回当前状态，不会起第二个服务；
- 启动失败（端口全被占用等）记录 `state.mcpError`，`McpStatus.error` 一并返回，设置页展示错误、
  状态栏不亮绿点；
- `McpStatus = { running, port, error? }` 通过 `mcp:status` 查询、`mcp:status-changed` 推送，
  渲染层 store 里的 `mcpStatus` 是唯一数据源。

### 7.1 客户端配置片段

设置 → MCP 服务 开启后会显示可一键复制的 JSON（端口跟随实际监听端口，写入剪贴板由主进程
`clipboard` 完成，避免 `file://` 下 Clipboard API 不可靠）：

```json
{
  "mcpServers": {
    "sylvie-tasklist": {
      "type": "http",
      "url": "http://127.0.0.1:37821/mcp"
    }
  }
}
```

- Claude Desktop / Cursor 等：直接粘贴到客户端配置的 `mcpServers`；
- VS Code（`.vscode/mcp.json`）：根键改为 `servers`，内容不变；
- 服务未运行（开关关闭或启动失败）时不展示配置块，避免把无效地址贴进客户端。

## 8. 安全与边界

- **仅回环监听**，无鉴权：同一台机器上的其他进程（同一用户）可以访问。这是本地工具的常见取舍，
  若未来需要隔离，可在 `/mcp` 前加一次性 token 或改用 stdio 传输。
- **数据不出本机**：工具只读写 `%APPDATA%/Sylvie TaskList/` 下的两个 JSON，不接受路径参数。
- **配置只读**：`get_settings` 不提供写入；配置修改仍由界面负责，唯一例外是分组改名/删除时
  对 `task.defaultGroup` 的联动修正。
- **删除语义保守**：删分组不删任务；没有批量删除工具，降低误操作半径。

## 9. 扩展指南

### 9.1 新增一个工具

1. 在 `packages/mcp/src/repository.ts` 增加方法（只声明语义）；
2. 在 `packages/mcp/src/tools/` 对应文件注册，写清 `title`、`description`、`inputSchema`、`annotations`：

```ts
server.registerTool(
  'archive_task',
  {
    title: '归档任务',
    description: '把已完成任务标记为归档，不再出现在默认列表。',
    inputSchema: { id: z.number().int().positive() },
    annotations: { idempotentHint: true },
  },
  async ({ id }) => textResult({ archived: repo.archiveTask(id) }),
);
```

3. 在 `packages/mcp/src/server.ts` 的 `register*Tools` 中挂载（或新增注册函数）；
4. 更新 instructions、根 README 的工具清单与本文档；
5. 在宿主适配器实现新方法，确保写操作走 `commitTasks` / `commitSettings`。

### 9.2 换一个宿主

端口很薄，任何运行时都能接：

```ts
import { startMcpHttpServer } from '@sylvie/mcp';

const repo: TaskListRepository = {
  getData: () => data,
  getSettings: () => settings,
  createTask: (input) => {
    /* 改内存 + 落盘 */
  },
  // …
};

const server = await startMcpHttpServer({ repo, version: '1.0.0', port: 37821 });
```

测试替身只需内存对象，不必启动 Electron。

## 10. 联调与排错

```bash
# 1) 初始化，拿 session id
SID=$(curl -s -D - -o /dev/null -X POST http://127.0.0.1:37821/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}' \
  | grep -i mcp-session-id | tr -d '\r' | awk '{print $2}')

# 2) 调用工具
curl -s -X POST http://127.0.0.1:37821/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tasks","arguments":{"status":"active","limit":5}}}'
```

| 现象                                   | 原因                                    | 处理                                                        |
| -------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `404 unknown session`                  | 未 `initialize`、会话已关闭或应用重启过 | 重新 `initialize` 拿新的 `mcp-session-id`                   |
| 连接被拒绝                             | MCP 开关未开启，或应用未运行            | 设置 → MCP 服务 打开；看状态栏绿点与实际端口                |
| `EADDRINUSE` 全部失败                  | 37821–37830 都被占用                    | 释放端口；服务会自动顺延，实际端口见 `/health`              |
| `Stateless transport cannot be reused` | 复用了同一个 transport 处理多次请求     | 会话模型：每会话独立 transport                              |
| `分组不存在：X`                        | 传了未创建的分组                        | 错误信息会列出可用分组，先 `create_group`                   |
| `beforeId 与 afterId 不能同时指定`     | 参数互斥                                | 二选一                                                      |
| 工具成功但界面没变                     | 窗口已销毁或渲染层未订阅                | 检查窗口状态与 `tasks:changed` 广播日志                     |
| 传了非法 `dueAt` 但没报错              | `normalizeDueInput` 对非法值返回空串    | 用 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm`，并用 `get_task` 核对 |

## 11. 测试建议与已知限制

- 建议用内存版 `TaskListRepository` + 直接 `createTaskListMcpServer` 做工具级单测，覆盖：
  空标题、分组重名、删除分组迁移条数、`beforeId`/`afterId` 互斥、`dueAt` 清空与规范化。
- HTTP 层可用 Hono 的 `app.request()` 直接打，不必真正监听端口。
- 当前**未接入自动化测试**，验证依赖手动 curl 联调 + `typecheck` + `lint`。
- 已知取舍：无鉴权、无速率限制；工具错误统一以文本返回，不做结构化错误码（客户端只能读消息）。
