import { useEffect, useRef, type JSX } from 'react';

import { PRIORITY_TEXT, groupColor, viewTasks } from '@sylvie/core';
import type { Task } from '@sylvie/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Chip, EmptyState, IconButton } from '@sylvie/ui';
import { Calendar, Clock, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';

import {
  describeDue,
  formatDateTime,
  formatDueFull,
  hexToRgba,
  shouldIgnoreClick,
} from '@sylvie/utils';
import type { FlashState } from '../store/taskStore';
import { useTaskStore } from '../store/taskStore';

const PRIORITY_TONE = { high: 'high', mid: 'mid', low: 'low' } as const;

interface TaskCardProps {
  task: Task;
  flash: FlashState | null;
  onOpen: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
}

function TaskCard({ task, flash, onOpen, onRequestDelete }: TaskCardProps): JSX.Element {
  const data = useTaskStore((state) => state.data);
  const overdueHighlight = useTaskStore((state) => state.settings['task.overdueHighlight']);
  const toggleTask = useTaskStore((state) => state.toggleTask);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task' },
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const color = groupColor(data, task.group);
  const due = task.dueAt ? describeDue(task.dueAt) : null;
  const showOverdue = overdueHighlight && due?.overdue === true;

  useEffect(() => {
    const node = cardRef.current;
    if (!node || !flash) {
      return;
    }
    const className = flash.done ? 'flash-done' : 'flash-undone';
    node.classList.remove('flash-done', 'flash-undone');
    void node.offsetWidth;
    node.classList.add(className);
    const timer = setTimeout(() => node.classList.remove(className), 950);
    return () => clearTimeout(timer);
  }, [flash]);

  const open = (): void => {
    if (!shouldIgnoreClick()) {
      onOpen(task);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`task-slot${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <motion.div
        ref={cardRef}
        layout="position"
        className={`task${task.done ? ' done' : ''}`}
        transition={{ layout: { duration: 0.28, ease: [0.2, 0.8, 0.3, 1] } }}
      >
        <input
          type="checkbox"
          checked={task.done}
          title={task.done ? '标记为未完成' : '标记为已完成'}
          onChange={() => toggleTask(task.id)}
        />

        <div
          className="task-body"
          role="button"
          tabIndex={0}
          title="点击查看 / 编辑任务详情"
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onOpen(task);
            }
          }}
        >
          <div className="task-title">{task.title}</div>
          {task.note && <div className="task-note">{task.note}</div>}
          <div className="task-meta">
            <Chip style={color ? { background: hexToRgba(color, 0.11), color } : undefined}>
              {task.group}
            </Chip>
            <Chip tone={PRIORITY_TONE[task.priority]}>{PRIORITY_TEXT[task.priority]}优先</Chip>
            <Chip tone="ghost" title="创建时间">
              <Clock size={11} /> {formatDateTime(task.createdAt)}
            </Chip>
            {due && !task.done && (
              <Chip tone={showOverdue ? 'overdue' : 'default'} title={formatDueFull(task.dueAt)}>
                {showOverdue ? (
                  <TriangleAlert size={11} />
                ) : due.hasTime ? (
                  <Clock size={11} />
                ) : (
                  <Calendar size={11} />
                )}
                {due.text}
              </Chip>
            )}
            {task.done && (
              <Chip tone="done" title="完成时间">
                ✓ {task.completedAt ? `${formatDateTime(task.completedAt)} 完成` : '已完成'}
              </Chip>
            )}
          </div>
        </div>

        <div className="task-actions">
          <IconButton
            title="编辑任务"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(task);
            }}
          >
            <Pencil size={13} />
          </IconButton>
          <IconButton
            tone="danger"
            title="删除任务"
            onClick={(event) => {
              event.stopPropagation();
              onRequestDelete(task);
            }}
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
      </motion.div>
    </div>
  );
}

function emptyMessage(search: string, filter: string): string {
  if (search) {
    return '没有匹配的任务，换个关键词试试';
  }
  if (filter === 'done') {
    return '还没有完成的任务';
  }
  if (filter === 'active') {
    return '所有任务都已完成 🎉';
  }
  return '暂无任务，点击「新建任务」开始吧';
}

interface TaskListProps {
  onOpenTask: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
}

/** 任务列表：dnd-kit 排序 + motion 布局动画 + 完成闪烁。 */
export function TaskList({ onOpenTask, onRequestDelete }: TaskListProps): JSX.Element {
  const data = useTaskStore((state) => state.data);
  const view = useTaskStore((state) => state.view);
  const flash = useTaskStore((state) => state.flash);
  const tasks = viewTasks(data, view, view.group);

  return (
    <div className="list-area">
      {tasks.length === 0 ? (
        <EmptyState icon="📋" text={emptyMessage(view.search, view.filter)} />
      ) : (
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="task-list">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                flash={flash?.id === task.id ? flash : null}
                onOpen={onOpenTask}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
