/** 任务优先级。 */
export type Priority = 'high' | 'mid' | 'low';

/** 任务筛选模式。 */
export type FilterMode = 'all' | 'active' | 'done';

/** 排序模式。`custom` 为拖拽得到的自定义顺序，其余为规则排序。 */
export type SortMode = 'custom' | 'priority' | 'due' | 'created';

/** 主题模式。 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 界面字号。 */
export type FontSize = 'small' | 'standard' | 'large';

/** 点击窗口关闭按钮时的行为。 */
export type CloseAction = 'tray' | 'quit';

/** 「全部」虚拟分组名。 */
export const ALL_GROUP = '全部';

/** 「未分组」虚拟分组名（分组被删除后任务的归属）。 */
export const UNGROUPED = '未分组';

/** 单个任务。 */
export interface Task {
  /** 任务唯一标识。 */
  id: number;
  /** 创建时间（毫秒时间戳）。 */
  createdAt: number;
  /**
   * 自定义排序顺序值（稀疏字段）。
   * 仅在拖拽过之后写入；缺省时回退 `createdAt` 排序。
   */
  order?: number;
  /** 是否已完成。 */
  done: boolean;
  /** 完成时间；未完成或已取消完成时为 null。 */
  completedAt: number | null;
  /** 标题。 */
  title: string;
  /** 备注（可为空串）。 */
  note: string;
  /** 所属分组名（弱引用）。 */
  group: string;
  /** 优先级。 */
  priority: Priority;
  /** 截止时间，ISO 格式 `YYYY-MM-DDTHH:mm`；未设置为空串。 */
  dueAt: string;
}

/** `tasks.json` 文件结构。 */
export interface TaskData {
  /** 分组名数组，数组顺序即侧边栏顺序。 */
  groups: string[];
  /** 分组名 → 十六进制色值。 */
  groupColors: Record<string, string>;
  /** 任务 id 自增计数器。 */
  seq: number;
  /** 任务列表。 */
  tasks: Task[];
}

/** `settings.json` 文件结构：扁平键 + 点分命名空间（与 VSCode 一致）。 */
export interface AppSettings {
  'appearance.theme': ThemeMode;
  'appearance.fontSize': FontSize;
  'window.closeAction': CloseAction;
  'task.defaultGroup': string;
  'task.defaultPriority': Priority;
  'task.overdueHighlight': boolean;
  'mcp.serverEnabled': boolean;
}

/** 任一配置键。 */
export type SettingKey = keyof AppSettings;

/** 视图状态（会话级，不写入 tasks.json / settings.json）。 */
export interface ViewState {
  group: string;
  filter: FilterMode;
  sort: SortMode;
  search: string;
}

/** 新建/编辑任务表单值。 */
export interface TaskDraft {
  title: string;
  note: string;
  group: string;
  priority: Priority;
  dueAt: string;
}
