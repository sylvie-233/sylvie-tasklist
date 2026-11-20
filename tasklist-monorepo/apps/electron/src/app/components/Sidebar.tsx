import type { JSX } from 'react';

import { ALL_GROUP, UNGROUPED, groupColor, groupCount, sidebarGroups } from '@sylvie/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '@sylvie/ui';
import { Pencil, X } from 'lucide-react';

import { useTaskStore } from '../store/taskStore';

/** 分组拖拽使用的 id 前缀（任务用数字 id，分组用字符串，互不冲突）。 */
export const groupDragId = (name: string): string => `group:${name}`;

interface GroupRowProps {
  group: string;
  count: number;
  active: boolean;
  color: string | null;
  showActions: boolean;
  isDragging?: boolean;
  isOver?: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
}

function GroupRow({
  group,
  count,
  active,
  color,
  showActions,
  isDragging = false,
  isOver = false,
  onSelect,
  onEdit,
  onDelete,
  setNodeRef,
  style,
  dragProps,
}: GroupRowProps): JSX.Element {
  const className = [
    'side-item',
    active ? 'active' : '',
    isDragging ? 'dragging' : '',
    isOver ? 'drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={style}
      role="button"
      tabIndex={0}
      title={group === ALL_GROUP ? '显示所有分组的任务' : `查看「${group}」分组`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      {...dragProps}
    >
      {group !== ALL_GROUP && (
        <span className={`dot${color ? '' : ' dot-default'}`} style={color ? { background: color } : undefined} />
      )}
      <span className="name">{group}</span>
      {showActions && onEdit && (
        <IconButton
          className="side-action"
          title="编辑分组（重命名 / 改颜色）"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <Pencil size={12} />
        </IconButton>
      )}
      {showActions && onDelete && (
        <IconButton
          tone="danger"
          className="side-action side-action-danger"
          title="删除分组（任务归入「未分组」）"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <X size={14} />
        </IconButton>
      )}
      <span className="count" title={`当前筛选下的任务数：${count}`}>
        {count}
      </span>
    </div>
  );
}

type SortableGroupProps = Omit<
  GroupRowProps,
  'setNodeRef' | 'style' | 'dragProps' | 'isDragging' | 'isOver'
>;

/** 可拖拽排序的自定义分组（同时作为任务的放置目标）。 */
function SortableGroup(props: SortableGroupProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: groupDragId(props.group),
      data: { type: 'group', name: props.group },
    });

  return (
    <GroupRow
      {...props}
      setNodeRef={setNodeRef}
      isDragging={isDragging}
      isOver={isOver}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragProps={{ ...attributes, ...listeners }}
    />
  );
}

/** 仅作为任务放置目标的虚拟分组（未分组）。 */
function DroppableGroup(props: SortableGroupProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: groupDragId(props.group),
    data: { type: 'group', name: props.group },
  });

  return <GroupRow {...props} setNodeRef={setNodeRef} isOver={isOver} />;
}

interface SidebarProps {
  onCreateGroup: () => void;
  onEditGroup: (group: string) => void;
  onDeleteGroup: (group: string) => void;
}

/** 左侧分组侧边栏：选择分组、编辑/删除、拖拽排序、把任务拖入分组。 */
export function Sidebar({ onCreateGroup, onEditGroup, onDeleteGroup }: SidebarProps): JSX.Element {
  const data = useTaskStore((state) => state.data);
  const view = useTaskStore((state) => state.view);
  const setView = useTaskStore((state) => state.setView);

  const groups = sidebarGroups(data);
  const sortableIds = data.groups.map(groupDragId);

  return (
    <aside className="sidebar">
      <div className="side-label">分组</div>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {groups.map((group) => {
          const isAll = group === ALL_GROUP;
          const isUngrouped = group === UNGROUPED;
          const common = {
            group,
            count: groupCount(data, view, group),
            active: view.group === group,
            color: isAll || isUngrouped ? null : groupColor(data, group),
            showActions: !isAll && !isUngrouped,
            onSelect: () => setView({ group }),
          } satisfies Partial<GroupRowProps>;

          if (isAll) {
            return <GroupRow key={group} {...common} />;
          }
          if (isUngrouped) {
            return <DroppableGroup key={group} {...common} />;
          }
          return (
            <SortableGroup
              key={group}
              {...common}
              onEdit={() => onEditGroup(group)}
              onDelete={() => onDeleteGroup(group)}
            />
          );
        })}
      </SortableContext>

      <button type="button" className="side-add" title="新建分组" onClick={onCreateGroup}>
        + 新建分组
      </button>
    </aside>
  );
}
