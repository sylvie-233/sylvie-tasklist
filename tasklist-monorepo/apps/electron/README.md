# @sylvie/electron · 桌面端

Sylvie TaskList 的 Electron 应用：主进程负责窗口、托盘、文件与 MCP 服务，渲染进程是 React 19 界面，
两者通过 preload 暴露的 `window.desktop` 通信。产品与使用说明见[根 README](../../../README.md)。

## 技术栈

| 层         | 选型                                                       |
| ---------- | ---------------------------------------------------------- |
| 构建       | Electron Forge 8 + `@electron-forge/plugin-vite`（Vite 8） |
| 主进程     | TypeScript + Node 20 API，无框架                           |
| 渲染进程   | React 19 + Tailwind CSS 4 + zustand                        |
| 组件与交互 | `@sylvie/ui`（Radix / sonner）、@dnd-kit、motion           |

## 目录结构

```text
apps/electron/
├── forge.config.ts          # 打包与 maker（Squirrel.Windows / ZIP，输出 dist/）
├── vite.main.config.mts     # 主进程构建（core / mcp / utils alias）
├── vite.preload.config.mts  # preload 构建（cjs 输出）
├── vite.renderer.config.mts # 渲染进程构建（含共享包 alias）
├── assets/                  # icon.png / icon.ico / tray.png（脚本生成）
├── scripts/generate-icon.mjs
└── src/
    ├── main.ts              # 入口：单实例、生命周期、模块装配
    ├── main/
    │   ├── context.ts       # 进程级状态、路径、广播、require 校验
    │   ├── storage.ts       # JSON 原子读写、加载归一化、持久化
    │   ├── window.ts        # 主窗口创建、显示、关闭行为
    │   ├── tray.ts          # 系统托盘
    │   ├── ipc/             # storage / files / window / mcp 按域注册
    │   ├── mcp/             # MCP 启停服务 + TaskListRepository 适配
    │   └── dev-capture.ts   # 截图钩子（界面回归）
    ├── preload.ts           # contextBridge 暴露 window.desktop
    ├── desktop-types.ts     # IPC 契约类型（DesktopApi / McpStatus 等）
    ├── renderer.tsx         # 渲染入口：先加载数据再挂载
    ├── index.css            # 应用布局样式与设计令牌引用
    └── app/
        ├── App.tsx          # 壳层：DndContext、弹窗编排、快捷键、主题
        ├── store/           # zustand store + 启动 hydrate 与防抖落盘
        ├── useAppearance.ts # 主题与字号映射
        └── components/      # TitleBar / MenuBar / Sidebar / Toolbar / TaskList / TaskDialog / SettingsPanel / StatusBar
```

## 主进程模块职责

| 模块                | 职责                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `main.ts`           | 单实例锁、`whenReady` 启动流程、before-quit 收尾；只做装配，不写业务                                          |
| `context.ts`        | `state`（window / tray / tasks / settings / mcp）、`getPaths()`、`broadcast()`、`requireTasks()`              |
| `storage.ts`        | `readJsonFile` + `writeJsonAtomic`（写 `.tmp` 再 rename）、启动加载与迁移、`persistTasks` / `persistSettings` |
| `window.ts`         | 无边框窗口 1100×720（最小 860×560）、关闭按 `window.closeAction` 隐藏到托盘、外链交给系统浏览器               |
| `tray.ts`           | 16px 托盘图标，左键切换显隐，右键菜单「显示主窗口 / 退出」                                                    |
| `ipc/*`             | 按域注册，`ipc/index.ts` 仅负责组装                                                                           |
| `mcp/service.ts`    | MCP 启停（幂等）、状态计算与广播、写入提交                                                                    |
| `mcp/repository.ts` | 把主进程缓存适配成 `TaskListRepository`（详见 [MCP 设计与实现](../../../docs/MCP服务设计与实现.md)）          |
| `dev-capture.ts`    | 开发期截图并退出，用于界面回归                                                                                |

## IPC 契约

类型定义在 `src/desktop-types.ts`，preload 原样暴露为 `window.desktop`。

| 通道                                                          | 方式   | 说明                                            |
| ------------------------------------------------------------- | ------ | ----------------------------------------------- |
| `storage:load`                                                | invoke | 一次返回 `{ tasks, settings, info }`            |
| `storage:save-tasks`                                          | invoke | 主进程侧再跑一次 `migrateTaskData` 后原子落盘   |
| `storage:save-settings`                                       | invoke | 迁移 + 落盘，并**立即应用** `mcp.serverEnabled` |
| `app:info`                                                    | invoke | 版本、平台、数据路径                            |
| `shell:open-data-folder`                                      | invoke | 打开 `userData` 目录                            |
| `clipboard:write-text`                                        | invoke | 写入系统剪贴板（复制 MCP 配置等）               |
| `tasks:export` / `tasks:import`                               | invoke | 任务备份导入导出（保存/打开对话框）             |
| `settings:export` / `settings:import`                         | invoke | 配置导入导出（导出保留点分键顺序）              |
| `window:minimize` / `window:toggle-maximize` / `window:close` | send   | 自绘标题栏三键                                  |
| `mcp:set-enabled`                                             | invoke | 开关并返回最新 `McpStatus`                      |
| `mcp:status`                                                  | invoke | 查询当前运行状态                                |
| `mcp:status-changed`                                          | event  | 状态变化推送                                    |
| `window:maximized-changed`                                    | event  | 最大化状态（标题栏按钮图标）                    |
| `tasks:changed` / `settings:changed`                          | event  | 主进程侧写入后通知渲染层刷新                    |

导入导出统一返回 `FileOpResult`：`{ ok: true, data, path }` 或 `{ ok: false, canceled?, error? }`，
渲染层据此区分“用户取消”和“真正失败”。

## 数据流

```text
渲染层交互 → zustand action → subscribe 防抖（tasks 300ms / settings 200ms）
          → window.desktop.saveTasks/Settings → 迁移 → writeJsonAtomic → %APPDATA%/Sylvie TaskList/*.json

MCP 工具 → TaskListRepository（主进程实现）→ commitTasks/commitSettings
        → 更新内存缓存 → 原子落盘 → broadcast('tasks:changed' / 'settings:changed')
        → 渲染层 replaceData/replaceSettings
```

两侧写盘都由渲染层订阅触发，但内容序列化后与上次一致时直接跳过，
因此 MCP 回写不会造成“界面 → 主进程 → 界面”的回声写盘。

## 窗口与托盘

- 无边框窗口（`frame: false`），标题栏拖动区用 `-webkit-app-region: drag`，按钮区 `no-drag`。
- 关闭按钮：`window.closeAction = tray` 且托盘存在时隐藏窗口，否则退出；托盘菜单「退出」走
  `state.quitting = true` 绕过该拦截。
- 单实例：第二个实例启动时唤起已有窗口；Squirrel 安装/更新事件直接退出。
- 开发模式（未打包）下 F12 打开 DevTools，打包后禁用。

## 构建与打包

```bash
pnpm --filter @sylvie/electron start     # 开发模式（Vite HMR）
pnpm --filter @sylvie/electron package   # 免安装目录 → dist/Sylvie TaskList-win32-x64/
pnpm --filter @sylvie/electron make      # 安装包 → dist/make/（Squirrel + ZIP）
pnpm --filter @sylvie/electron typecheck
pnpm --filter @sylvie/electron lint
pnpm --filter @sylvie/electron clean     # 清理 .vite / dist / out / .turbo
```

- 产物目录由 `forge.config.ts` 的 `outDir: 'dist'` 指定；可执行文件名 `SylvieTaskList`。
- 图标由 `scripts/generate-icon.mjs` 零依赖生成（PNG + ICO + 托盘图），改图标后跑 `pnpm --filter @sylvie/electron icon`。
- 共享包 `@sylvie/core|ui|utils|mcp` 通过 Vite alias 直连 TS 源码，构建前无需先编译 packages。

## 界面回归截图

`dev-capture` 钩子在渲染完成后截图并退出，无需 UI 自动化：

```bash
TASKLIST_CAPTURE=shot.png pnpm desktop:dev                                  # 主界面
TASKLIST_CAPTURE=shot.png TASKLIST_CAPTURE_VIEW=settings pnpm desktop:dev   # 设置页
TASKLIST_CAPTURE=shot.png TASKLIST_CAPTURE_VIEW=settings \
  TASKLIST_CAPTURE_CATEGORY=配置文件 pnpm desktop:dev                        # 指定设置分类
TASKLIST_CAPTURE=shot.png TASKLIST_CAPTURE_VIEW=task pnpm desktop:dev       # 任务详情
```

截图延迟 2s（设置页额外 900ms）等待数据加载与动画结束；生产启动不会触发。
`TASKLIST_CAPTURE_CLICK=<选择器>` 可在截图前点击任意元素（例如验证「复制配置」按钮）。

## 依赖与工程约定

- `.npmrc` 开启 `public-hoist-pattern[]=*`：Vite 预打包需要解析 Radix / dnd-kit 的传递依赖，
  pnpm 严格依赖下否则会报模块找不到。
- `vite.renderer.config.mts` 对 `react` / `react-dom` 做 `dedupe`，避免共享包带入第二份 React 触发
  “Invalid hook call”。
- Vite 配置使用 `.mts` 扩展名，配合 `fileURLToPath(import.meta.url)` 解析共享包路径，规避 CJS/ESM 警告。
- 渲染产物约 530 KB（dnd-kit + Radix + motion），桌面场景未做代码分割。

## 已知限制

- 安装包未签名，Squirrel 安装会触发 SmartScreen 提示。
- 未接入单元测试；当前验证手段是 `typecheck` + `lint` + `package` + 截图回归。
- 早期产物可能残留 `out/`（被系统句柄占用时无法删除）；正常输出已改为 `dist/`，重启后可手动清理。
