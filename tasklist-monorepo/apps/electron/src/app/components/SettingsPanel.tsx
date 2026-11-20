import { useEffect, useMemo, useState, type JSX } from 'react';

import {
  HOTKEYS,
  SETTINGS_CATEGORIES,
  SETTINGS_ITEMS,
  migrateSettings,
  resolveSettingOptions,
  serializeSettings,
} from '@sylvie/core';
import type { AppSettings, SettingCategoryId, SettingItem, SettingKey } from '@sylvie/core';
import {
  Button,
  HotkeyRow,
  Modal,
  Select,
  SettingRow,
  Switch,
  TextInput,
  toast,
} from '@sylvie/ui';

import type { AppInfo } from '../../desktop-types';
import { useTaskStore } from '../store/taskStore';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

interface SettingsPanelProps {
  open: boolean;
  info: AppInfo;
  onClose: () => void;
  askConfirm: (request: ConfirmRequest) => Promise<boolean>;
}

const DATA_KEYWORDS = '数据 文件 位置 备份 tasks.json 导出 导入 打开 文件夹';
const JSON_KEYWORDS = '配置文件 settings.json 编辑 保存 放弃 导入 导出 恢复默认';
const HOTKEY_KEYWORDS = '快捷键 hotkey ctrl esc';

function matchItem(item: SettingItem, keyword: string): boolean {
  return `${item.title} ${item.desc} ${item.key}`.toLowerCase().includes(keyword);
}

/** 设置面板：分类导航 + 搜索 + 设置项 + settings.json 编辑器。 */
export function SettingsPanel({
  open,
  info,
  onClose,
  askConfirm,
}: SettingsPanelProps): JSX.Element {
  const data = useTaskStore((state) => state.data);
  const settings = useTaskStore((state) => state.settings);
  const mcp = useTaskStore((state) => state.mcp);
  const updateSetting = useTaskStore((state) => state.updateSetting);
  const applySettings = useTaskStore((state) => state.applySettings);
  const resetSettings = useTaskStore((state) => state.resetSettings);
  const replaceData = useTaskStore((state) => state.replaceData);

  const [category, setCategory] = useState<SettingCategoryId>('general');
  const [keyword, setKeyword] = useState('');
  const [jsonText, setJsonText] = useState(() => serializeSettings(settings));

  useEffect(() => {
    setJsonText(serializeSettings(settings));
  }, [settings, open]);

  const kw = keyword.trim().toLowerCase();
  const matchedItems = useMemo(
    () => SETTINGS_ITEMS.filter((item) => (kw ? matchItem(item, kw) : true)),
    [kw],
  );

  const categoryCount = (id: SettingCategoryId): number => {
    if (!kw) {
      return 0;
    }
    if (id === 'data') {
      return DATA_KEYWORDS.includes(kw) ? 1 : 0;
    }
    if (id === 'json') {
      return JSON_KEYWORDS.includes(kw) ? 1 : 0;
    }
    if (id === 'hotkeys') {
      return HOTKEY_KEYWORDS.includes(kw) ? 1 : 0;
    }
    return matchedItems.filter((item) => item.cat === id).length;
  };

  const changeSetting = (key: SettingKey, value: AppSettings[SettingKey]): void => {
    updateSetting(key, value);
  };

  const saveJson = (): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      toast.error(`JSON 格式错误：${error instanceof Error ? error.message : '无法解析'}`);
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      toast.error('配置内容必须是一个对象');
      return;
    }
    applySettings(migrateSettings(parsed));
  };

  const handleExportTasks = async (): Promise<void> => {
    const result = await window.desktop.exportTasks(data);
    if (result.ok) {
      toast.success('已导出任务备份');
    } else if (!result.canceled) {
      toast.error(result.error ?? '导出失败');
    }
  };

  const handleImportTasks = async (): Promise<void> => {
    const result = await window.desktop.importTasks();
    if (!result.ok) {
      if (!result.canceled) {
        toast.error(result.error ?? '导入失败');
      }
      return;
    }
    const confirmed = await askConfirm({
      title: '导入任务备份',
      message: `将用所选文件（${result.data.tasks.length} 个任务、${result.data.groups.length} 个分组）覆盖当前全部任务，此操作不可撤销。`,
      confirmText: '覆盖导入',
      danger: true,
    });
    if (confirmed) {
      replaceData(result.data);
      toast.success('已导入任务备份');
    }
  };

  const handleExportSettings = async (): Promise<void> => {
    const result = await window.desktop.exportSettings(settings);
    if (result.ok) {
      toast.success('已导出配置');
    } else if (!result.canceled) {
      toast.error(result.error ?? '导出失败');
    }
  };

  const handleImportSettings = async (): Promise<void> => {
    const result = await window.desktop.importSettings();
    if (!result.ok) {
      if (!result.canceled) {
        toast.error(result.error ?? '导入失败');
      }
      return;
    }
    const confirmed = await askConfirm({
      title: '导入配置',
      message: '将用所选文件覆盖当前应用配置（任务数据不受影响）。',
      confirmText: '覆盖导入',
      danger: true,
    });
    if (confirmed) {
      applySettings(result.data);
    }
  };

  const handleResetSettings = async (): Promise<void> => {
    const confirmed = await askConfirm({
      title: '恢复默认设置',
      message: '将把所有配置项恢复为默认值，任务数据（tasks.json）不受影响。',
      confirmText: '恢复默认',
      danger: true,
    });
    if (confirmed) {
      resetSettings();
    }
  };

  const renderControl = (item: SettingItem): JSX.Element => {
    if (item.type === 'select') {
      const options = resolveSettingOptions(item, data.groups);
      return (
        <Select
          value={String(settings[item.key])}
          title={item.desc}
          style={{ width: 170 }}
          onChange={(event) => changeSetting(item.key, event.target.value as never)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    }

    const checked = settings[item.key] === true;
    if (item.type === 'switch') {
      return (
        <Switch
          checked={checked}
          title={item.desc}
          onCheckedChange={(next) => changeSetting(item.key, next as never)}
        />
      );
    }

    return (
      <input
        type="checkbox"
        checked={checked}
        title={item.desc}
        style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }}
        onChange={(event) => changeSetting(item.key, event.target.checked as never)}
      />
    );
  };

  const renderItemRow = (item: SettingItem, withCategory: boolean): JSX.Element => (
    <SettingRow
      key={item.key}
      title={item.title}
      description={item.desc}
      category={
        withCategory
          ? (SETTINGS_CATEGORIES.find((entry) => entry.id === item.cat)?.name ?? '')
          : undefined
      }
    >
      {renderControl(item)}
    </SettingRow>
  );

  const renderDataCategory = (): JSX.Element => (
    <>
      <h4>文件位置</h4>
      <SettingRow
        title="任务数据"
        description="所有任务与分组的存储位置，建议定期导出备份"
        block
      >
        <div className="set-path">{info.paths.tasksPath}</div>
      </SettingRow>
      <SettingRow
        title="应用配置"
        description="界面、窗口与 MCP 等配置项，与任务数据完全隔离"
        block
      >
        <div className="set-path">{info.paths.settingsPath}</div>
      </SettingRow>

      <h4>任务数据备份</h4>
      <SettingRow
        title="导出 / 导入任务备份"
        description="导出为 tasks.json；导入会覆盖当前全部任务，请谨慎操作"
      >
        <div className="set-ctrl set-ctrl--stack">
          <Button
            size="sm"
            title={`将任务数据导出为 tasks.json 文件（${data.tasks.length} 个任务）`}
            onClick={() => void handleExportTasks()}
          >
            导出备份
          </Button>
          <Button
            size="sm"
            title="从备份文件导入任务数据（覆盖当前任务）"
            onClick={() => void handleImportTasks()}
          >
            导入备份
          </Button>
          <Button
            size="sm"
            title="在文件资源管理器中打开数据文件夹"
            onClick={() => void window.desktop.openDataFolder()}
          >
            打开数据文件夹
          </Button>
        </div>
      </SettingRow>
    </>
  );

  const renderJsonCategory = (): JSX.Element => (
    <>
      <h4>编辑 settings.json</h4>
      <SettingRow
        title="配置原文"
        description="配置键按“分类.名称”点分命名（如 appearance.theme），保持扁平结构。点击“保存修改”后生效，仅识别合法的配置键，未知键将被忽略。任务数据存放在 tasks.json 中，两者互不影响。"
        block
      >
        <textarea
          className="json-editor"
          spellCheck={false}
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
        />
      </SettingRow>
      <div className="set-ctrl set-ctrl--wrap">
        <Button
          size="sm"
          title="校验并写入 settings.json，立即生效"
          onClick={saveJson}
        >
          保存修改
        </Button>
        <Button
          size="sm"
          title="丢弃编辑，还原为当前生效配置"
          onClick={() => {
            setJsonText(serializeSettings(settings));
            toast('已还原为当前生效配置');
          }}
        >
          放弃修改
        </Button>
        <Button
          size="sm"
          title="导出 settings.json"
          onClick={() => void handleExportSettings()}
        >
          导出配置
        </Button>
        <Button
          size="sm"
          title="从 settings.json 文件导入配置"
          onClick={() => void handleImportSettings()}
        >
          导入配置
        </Button>
        <Button
          size="sm"
          title="恢复默认配置（不影响任务数据）"
          onClick={() => void handleResetSettings()}
        >
          恢复默认
        </Button>
      </div>
    </>
  );

  const renderHotkeys = (): JSX.Element => (
    <>
      <h4>键盘快捷键</h4>
      {HOTKEYS.map((hotkey) => (
        <HotkeyRow key={hotkey.name} name={hotkey.name} keys={hotkey.keys} />
      ))}
    </>
  );

  const renderContent = (): JSX.Element => {
    if (category === 'data') {
      return renderDataCategory();
    }
    if (category === 'json') {
      return renderJsonCategory();
    }
    if (category === 'hotkeys') {
      return renderHotkeys();
    }
    return (
      <>
        {matchedItems
          .filter((item) => item.cat === category)
          .map((item) => renderItemRow(item, false))}
        {category === 'mcp' && (
          <SettingRow
            title="运行状态"
            description={
              mcp.running
                ? `运行中 · 监听 127.0.0.1:${mcp.port ?? '-'}（Streamable HTTP，端点 /mcp）`
                : mcp.error
                  ? `启动失败：${mcp.error}`
                  : '未运行'
            }
          />
        )}
      </>
    );
  };

  const renderSearchResults = (): JSX.Element => {
    const items = SETTINGS_ITEMS.filter((item) => matchItem(item, kw));
    if (items.length === 0) {
      return <div className="settings-empty">没有匹配的设置项</div>;
    }
    return <>{items.map((item) => renderItemRow(item, true))}</>;
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="设置"
      size="xl"
      headerExtra={
        <TextInput
          className="settings-search"
          placeholder="搜索设置…"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      }
    >
      <div className="settings-body">
        <nav className="settings-nav">
          {SETTINGS_CATEGORIES.map((entry) => {
            const count = categoryCount(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                className={`nav-item${!kw && category === entry.id ? ' active' : ''}`}
                onClick={() => {
                  setKeyword('');
                  setCategory(entry.id);
                }}
              >
                {entry.name}
                {kw && count > 0 && <span className="nav-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="settings-content">
          {kw ? (
            renderSearchResults()
          ) : (
            <>
              <h4>{SETTINGS_CATEGORIES.find((entry) => entry.id === category)?.name}</h4>
              {renderContent()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
