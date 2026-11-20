# Sylvie TaskList

本地任务清单桌面应用（仅 Windows）。Electron Forge + Vite + React 19，数据完全保存在本机，无网络依赖。

> 产品设计见 [`../docs/任务清单v1功能规划.md`](../docs/任务清单v1功能规划.md) 与交互原型
> [`../docs/任务清单-v1原型.html`](../docs/任务清单-v1原型.html)。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面容器 | Electron Forge 8 + Vite 8（`plugin-vite`） |
| 界面 | React 19 + TypeScript + Tailwind CSS 4 |
| 状态 | **zustand**（含 `subscribeWithSelector`，非 React 侧订阅落盘） |
| 设计系统 | `packages/ui`：Radix UI（Dialog / Switch）+ 自有设计令牌 |
| 交互 | **@dnd-kit**（任务与分组拖拽）、**motion**（列表布局动画）、**sonner**（Toast） |
| 日期 | date-fns |
| 服务端 | **Hono** + **@modelcontextprotocol/sdk**（MCP，官方 SDK 的 Streamable HTTP，独立在 `packages/mcp`） |

原则：协议、弹窗、拖拽、动画、Toast 一律用成熟库，业务侧只写领域逻辑与视图组装。

## 目录结构

```
tasklist-monorepo/
├── apps/
│   └── electron/
│       ├── forge.config.ts        # 打包与 maker 配置（Squirrel.Windows / ZIP，输出 dist/）
│       ├── assets/                # 图标（scripts/generate-icon.mjs 生成，零依赖）
│       └── src/
│           ├── main.ts            # 主进程入口：只做生命周期与模块装配（~70 行）
│           ├── main/              # 主进程按域拆分
│           │   ├── context.ts     # 进程级状态 / 路径 / 信息 / 广播
│           │   ├── storage.ts     # tasks.json / settings.json 原子读写与迁移
│           │   ├── window.ts      # 主窗口创建、显隐、关闭行为
│           │   ├── tray.ts        # 系统托盘与菜单
│           │   ├── ipc/           # IPC 按域注册：storage / files / window / mcp
│           │   ├── mcp/           # MCP 启停服务 + TaskListRepository 适配
│           │   └── dev-capture.ts # 开发用截图钩子（GUI 回归）
│           ├── preload.ts         # contextBridge 暴露 window.desktop
│           ├── renderer.tsx       # 渲染进程入口
│           ├── index.css          # 应用布局样式（设计令牌来自 @sylvie/ui）
│           └── app/
│               ├── App.tsx        # 壳层：DndContext、弹窗编排、快捷键、主题
│               ├── store/
│               │   ├── taskStore.ts   # zustand store（数据 / 设置 / 视图 / 反馈）
│               │   └── bootstrap.ts   # 启动加载 + 防抖落盘 + 主进程事件
│               ├── useAppearance.ts   # 主题与字号映射（含跟随系统）
│               ├── dragGuard.ts       # 拖拽结束后的点击抑制
│               └── components/        # TitleBar / MenuBar / Sidebar / Toolbar / TaskList / TaskDialog / SettingsPanel / StatusBar
└── packages/
    ├── core/                      # 领域模型：类型 / 默认值 / 排序 / 迁移 / 设置 schema / 格式化
    ├── mcp/                       # MCP 服务：工具定义 + Hono HTTP 传输 + TaskListRepository 端口
    ├── ui/                        # 设计系统：令牌、Button/Chip/Field/Modal/Switch/Toaster 等
    └── tsconfig/                  # 共享 TypeScript 配置
```

- `packages/mcp` 不依赖 Electron：只声明 `TaskListRepository` 端口（读数据 / 建任务 / 改分组…），
  由宿主（主进程）实现并通过 `startMcpHttpServer({ repo, version, port })` 注入，便于以后在其他运行时复用。

- `packages/core` 与 `packages/ui` 以 **TS 源码**形式被应用消费（`exports` 指向 `src/index.ts`），
  由 Vite alias 直接参与打包，省掉构建产物与 watch 流程；因此不适合直接发布 npm。
- `packages/ui` 只内置**无业务语义**的组件；任务卡片、设置面板等业务组装留在应用内。
- pnpm 开启了 `public-hoist-pattern`（见 `.npmrc`），否则 Vite 预打包无法解析 Radix / dnd-kit 的传递依赖。

## 快速开始

```bash
pnpm install

pnpm desktop:dev       # 开发模式（electron-forge start + Vite HMR）
pnpm desktop:package   # 打包为免安装目录（dist/）
pnpm desktop:make      # 生成 Windows 安装包（Squirrel.Windows + ZIP，输出 dist/make）
pnpm typecheck         # 全仓库类型检查
```

图标已随仓库提交；如需重新生成：`pnpm --filter @sylvie/electron icon`。

界面回归截图（无需 UI 自动化工具）：

```bash
TASKLIST_CAPTURE=shot.png pnpm desktop:dev                       # 主界面
TASKLIST_CAPTURE=shot.png TASKLIST_CAPTURE_SETTINGS=1 pnpm desktop:dev  # 打开设置页
```

## 数据模型

两份 JSON 文件，均位于 `%APPDATA%/Sylvie TaskList/`（Electron `app.getPath('userData')`）：

| 文件 | 职责 |
| --- | --- |
| `tasks.json` | 分组、分组颜色、任务列表（用户数据） |
| `settings.json` | 应用配置（点分命名空间扁键，与 VSCode 风格一致） |

`tasks.json` 中的任务：

```jsonc
{
  "id": 1,
  "createdAt": 1763612345000,      // 创建时间（ms）
  "order": 1763612344999,          // 自定义排序值（可选，仅拖拽过才写入）
  "done": false,
  "completedAt": null,             // 完成时间，取消完成时置 null
  "title": "完成 v1 原型评审",
  "note": "对照功能清单逐项确认",
  "group": "工作",
  "priority": "high",              // high | mid | low
  "dueAt": "2026-11-21T18:00"      // 截止时间，空串表示未设置
}
```

`settings.json`（默认值）：

```json
{
  "appearance.theme": "light",
  "appearance.fontSize": "standard",
  "window.closeAction": "tray",
  "task.defaultGroup": "工作",
  "task.defaultPriority": "mid",
  "task.overdueHighlight": true,
  "mcp.serverEnabled": false
}
```

容错策略（`packages/core/src/migration.ts`）：

- 旧字段名 `created` / `due` 自动迁移为 `createdAt` / `dueAt`，纯日期截止时间补 `T09:00`；
- 未知配置键忽略，值类型或枚举非法时回退默认值；
- 归属到已删除分组的任务归入「未分组」，无标题的坏任务丢弃；
- 首次启动写入示例数据。

## 状态与持久化

- `taskStore.ts` 用 zustand 定义唯一的应用状态：`data` / `settings` / `view` / `flash` / `mcp`；
- 组件通过 `useTaskStore(state => state.xxx)` 选择性订阅，避免全局重渲染；
- `bootstrap.ts` 在启动时 `hydrate`，并用 `subscribeWithSelector` 订阅 `data` 与 `settings`，
  经 `perfect-debounce` 防抖后走 IPC 落盘；内容未变化时跳过写入（避免 MCP 回写造成回声）；
- 视图状态（分组 / 筛选 / 排序 / 搜索）是会话级内存状态，不写入文件。

## 交互实现要点

- **拖拽**：一个 `DndContext` 同时服务任务列表（`SortableContext`）与侧边栏分组；
  把任务拖到分组项上 = 移动分组，拖动分组 = 调整顺序；拖动后自动切到「自定义排序」。
- **动画**：列表重排、完成沉底用 `motion` 的 `layout` 动画，不再手写 FLIP；
- **弹窗 / 开关 / Toast**：Radix Dialog、Radix Switch、sonner，Esc / 遮罩点击 / 焦点陷阱由库负责。

## MCP Server

设置 → MCP 服务 中开启「启动 MCP Server」，**立即生效无需重启**；运行后状态栏右下角显示绿点。

- 端点：`POST http://127.0.0.1:37821/mcp`（Streamable HTTP，JSON 响应），`GET /health` 探活
- 会话：按 `mcp-session-id` 头维护（SDK 规范要求，首次 `initialize` 的响应头返回该 id）
- 只监听回环地址；端口被占用时自动向后寻找（37821 起，最多 10 个）
- 工具（共 13 个，定义在 `packages/mcp/src/tools`）：

  | 分类 | 工具 | 说明 |
  | --- | --- | --- |
  | 查询 | `list_tasks` | 分组 / 状态 / 优先级 / 关键词 / 逾期 / 截止区间过滤，可指定排序与条数 |
  | 查询 | `get_task` | 按 id 取单个任务 |
  | 查询 | `get_overview` | 总数 / 进行中 / 已完成 / 逾期、按分组分布、最近到期任务 |
  | 查询 | `list_groups` | 分组列表（颜色 + 计数，含「未分组」） |
  | 查询 | `get_settings` | 读取当前应用配置 |
  | 任务 | `create_task` | 创建任务（分组省略时用默认分组） |
  | 任务 | `update_task` | 改标题 / 备注 / 分组 / 优先级 / 截止时间（`dueAt: ""` 清空） |
  | 任务 | `set_task_done` | 标记完成 / 恢复进行中（自动维护完成时间） |
  | 任务 | `delete_task` | 删除任务 |
  | 任务 | `move_task` | 改分组，或按 `beforeId` / `afterId` 调整自定义顺序 |
  | 分组 | `create_group` | 新建分组（可带 `#RRGGBB` 颜色） |
  | 分组 | `update_group` | 重命名（联动任务）/ 改色（空串清除） |
  | 分组 | `delete_group` | 删除分组（任务归入「未分组」，返回迁移条数） |

- 入参校验由 zod 完成；业务错误（任务不存在、分组重名、颜色非法等）以 `isError: true` 的工具结果返回；
- 所有写操作经仓库端口回到主进程：更新缓存 → 原子落盘 → 广播给渲染进程，界面实时同步

手动联调：

```bash
# 1) 初始化，拿 session id
curl -s -D - -o /dev/null -X POST http://127.0.0.1:37821/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}' \
  | grep -i mcp-session-id

# 2) 带 session id 调用工具
curl -s -X POST http://127.0.0.1:37821/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'mcp-session-id: <上一步的 id>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tasks","arguments":{}}}'
```

## 已知限制

- 安装包未做代码签名，Squirrel 安装时会触发 SmartScreen 提示；
- 未接入 ESLint / 单元测试，类型检查 + 打包 + 截图回归是当前验证手段；
- 渲染进程产物约 530 KB（dnd-kit + Radix + motion），桌面场景未做代码分割。
