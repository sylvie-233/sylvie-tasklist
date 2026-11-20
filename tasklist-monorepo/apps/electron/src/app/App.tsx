import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import { ALL_GROUP, GROUP_PALETTE, groupColor } from '@sylvie/core';
import type { Task, TaskDraft } from '@sylvie/core';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ConfirmDialog, InputDialog, Toaster } from '@sylvie/ui';

import type { AppInfo } from '../desktop-types';
import { MenuBar } from './components/MenuBar';
import { SettingsPanel, type ConfirmRequest } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TaskDialog } from './components/TaskDialog';
import { TaskList } from './components/TaskList';
import { TitleBar } from './components/TitleBar';
import { Toolbar } from './components/Toolbar';
import { markDragEnd } from '@sylvie/utils';
import { useTaskStore } from './store/taskStore';
import { useAppearance } from './useAppearance';

interface AppProps {
  info: AppInfo;
}

interface TaskDialogState {
  open: boolean;
  task: Task | null;
}

interface GroupDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  group?: string;
}

interface ConfirmState extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

export function App({ info }: AppProps): JSX.Element {
  const dark = useAppearance();

  const data = useTaskStore((state) => state.data);
  const settings = useTaskStore((state) => state.settings);
  const view = useTaskStore((state) => state.view);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const addGroup = useTaskStore((state) => state.addGroup);
  const updateGroup = useTaskStore((state) => state.updateGroup);
  const deleteGroup = useTaskStore((state) => state.deleteGroup);
  const moveTask = useTaskStore((state) => state.moveTask);
  const moveTaskToGroup = useTaskStore((state) => state.moveTaskToGroup);
  const moveGroup = useTaskStore((state) => state.moveGroup);

  const searchRef = useRef<HTMLInputElement>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>({ open: false, task: null });
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>({ open: false, mode: 'create' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const askConfirm = useCallback(
    (request: ConfirmRequest): Promise<boolean> =>
      new Promise<boolean>((resolve) => setConfirmState({ ...request, resolve })),
    [],
  );

  const closeConfirm = (confirmed: boolean): void => {
    confirmState?.resolve(confirmed);
    setConfirmState(null);
  };

  const openCreateTask = useCallback(() => {
    setTaskDialog({ open: true, task: null });
  }, []);

  const openTask = (task: Task): void => {
    setTaskDialog({ open: true, task });
  };

  const defaultGroup = view.group !== ALL_GROUP ? view.group : settings['task.defaultGroup'];

  const saveTask = (draft: TaskDraft): void => {
    if (taskDialog.task) {
      updateTask(taskDialog.task.id, draft);
    } else {
      addTask(draft);
    }
    setTaskDialog({ open: false, task: null });
  };

  const requestDeleteTask = async (task: Task): Promise<void> => {
    const confirmed = await askConfirm({
      title: '删除任务',
      message: `确定删除「${task.title}」吗？此操作不可恢复。`,
      confirmText: '删除',
      danger: true,
    });
    if (confirmed) {
      deleteTask(task.id);
    }
  };

  const requestDeleteGroup = async (group: string): Promise<void> => {
    const count = data.tasks.filter((task) => task.group === group).length;
    const confirmed = await askConfirm({
      title: '删除分组',
      message: `确定删除分组「${group}」吗？该分组下的 ${count} 个任务将归入「未分组」。`,
      confirmText: '删除',
      danger: true,
    });
    if (confirmed) {
      deleteGroup(group);
    }
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    markDragEnd();
    const { active, over } = event;
    if (!over) {
      return;
    }
    const activeData = active.data.current as { type?: string; name?: string } | undefined;
    const overData = over.data.current as { type?: string; name?: string } | undefined;

    if (activeData?.type === 'task') {
      const taskId = Number(active.id);
      if (overData?.type === 'task') {
        moveTask(taskId, Number(over.id));
      } else if (overData?.type === 'group' && overData.name) {
        moveTaskToGroup(taskId, overData.name);
      }
      return;
    }

    if (activeData?.type === 'group' && overData?.type === 'group') {
      if (activeData.name && overData.name) {
        moveGroup(activeData.name, overData.name);
      }
    }
  };

  // 快捷键：Ctrl+N / Ctrl+F / Ctrl+,
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      const dialogOpen =
        settingsOpen ||
        taskDialog.open ||
        groupDialog.open ||
        confirmState !== null ||
        aboutOpen;

      if (mod && event.key.toLowerCase() === 'n' && !dialogOpen) {
        event.preventDefault();
        openCreateTask();
        return;
      }
      if (mod && event.key.toLowerCase() === 'f' && !dialogOpen) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        setSettingsOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aboutOpen, confirmState, groupDialog.open, openCreateTask, settingsOpen, taskDialog.open]);

  const editingGroup = groupDialog.mode === 'edit' ? groupDialog.group : undefined;

  return (
    <div className="app-shell">
      <TitleBar />
      <MenuBar
        onNewTask={openCreateTask}
        onNewGroup={() => setGroupDialog({ open: true, mode: 'create' })}
        onOpenSettings={() => setSettingsOpen(true)}
        onAbout={() => setAboutOpen(true)}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="main">
          <Sidebar
            onCreateGroup={() => setGroupDialog({ open: true, mode: 'create' })}
            onEditGroup={(group) => setGroupDialog({ open: true, mode: 'edit', group })}
            onDeleteGroup={(group) => void requestDeleteGroup(group)}
          />
          <div className="content">
            <Toolbar onNewTask={openCreateTask} searchRef={searchRef} />
            <TaskList
              onOpenTask={openTask}
              onRequestDelete={(task) => void requestDeleteTask(task)}
            />
          </div>
        </div>
      </DndContext>

      <StatusBar info={info} />

      <TaskDialog
        open={taskDialog.open}
        task={taskDialog.task}
        groups={data.groups}
        defaultGroup={defaultGroup}
        defaultPriority={settings['task.defaultPriority']}
        onSave={saveTask}
        onClose={() => setTaskDialog({ open: false, task: null })}
      />

      <InputDialog
        open={groupDialog.open}
        title={groupDialog.mode === 'create' ? '新建分组' : '编辑分组'}
        label="分组名称"
        placeholder="如：工作"
        initialValue={editingGroup ?? ''}
        withColor
        colors={GROUP_PALETTE}
        initialColor={editingGroup ? groupColor(data, editingGroup) : null}
        confirmText={groupDialog.mode === 'create' ? '创建' : '保存'}
        onCancel={() => setGroupDialog({ open: false, mode: 'create' })}
        onSubmit={(value, color) => {
          const ok =
            groupDialog.mode === 'create'
              ? addGroup(value, color)
              : editingGroup
                ? updateGroup(editingGroup, value, color)
                : false;
          if (!ok) {
            return;
          }
          setGroupDialog({ open: false, mode: 'create' });
        }}
      />

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        description={confirmState?.message}
        confirmText={confirmState?.confirmText}
        danger={confirmState?.danger}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />

      <ConfirmDialog
        open={aboutOpen}
        title="关于 Sylvie TaskList"
        description={`Sylvie TaskList v${info.version}\nReact 19 + Electron Forge + Vite\n本地任务清单桌面应用（仅 Windows）\n\n数据目录：${info.paths.dataDir}`}
        confirmText="知道了"
        hideCancel
        onConfirm={() => setAboutOpen(false)}
        onCancel={() => setAboutOpen(false)}
      />

      <SettingsPanel
        open={settingsOpen}
        info={info}
        onClose={() => setSettingsOpen(false)}
        askConfirm={askConfirm}
      />

      <Toaster theme={dark ? 'dark' : 'light'} />
    </div>
  );
}
