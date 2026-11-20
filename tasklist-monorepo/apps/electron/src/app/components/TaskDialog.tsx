import { useEffect, useState, type JSX } from 'react';

import { PRIORITY_TEXT, UNGROUPED, formatDateTime } from '@sylvie/core';
import type { Priority, Task, TaskDraft } from '@sylvie/core';
import { Button, Field, Modal, Select, TextArea, TextInput } from '@sylvie/ui';

interface TaskDialogProps {
  open: boolean;
  /** 为空表示新建任务。 */
  task: Task | null;
  groups: string[];
  defaultGroup: string;
  defaultPriority: Priority;
  onSave: (draft: TaskDraft) => void;
  onClose: () => void;
}

/** 任务新建 / 详情编辑弹窗（查看与编辑合一）。 */
export function TaskDialog({
  open,
  task,
  groups,
  defaultGroup,
  defaultPriority,
  onSave,
  onClose,
}: TaskDialogProps): JSX.Element {
  const groupOptions = Array.from(
    new Set([...groups, ...(task ? [task.group] : []), UNGROUPED]),
  );
  const fallbackGroup = groupOptions.includes(defaultGroup)
    ? defaultGroup
    : (groupOptions[0] ?? UNGROUPED);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [group, setGroup] = useState(fallbackGroup);
  const [priority, setPriority] = useState<Priority>(defaultPriority);
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(task?.title ?? '');
    setNote(task?.note ?? '');
    setGroup(task?.group ?? fallbackGroup);
    setPriority(task?.priority ?? defaultPriority);
    setDueAt(task?.dueAt ?? '');
    setError('');
    // 打开时按当前 props 初始化一次，编辑期间不跟随 props 重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const submit = (): void => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('标题不能为空');
      return;
    }
    onSave({ title: trimmed, note, group, priority, dueAt });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={task ? '任务详情' : '新建任务'}
      size="md"
    >
      <Field label="标题" required>
        <TextInput
          autoFocus
          className="input-lg"
          placeholder="要做什么？"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) {
              setError('');
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
      </Field>

      <Field label="备注">
        <TextArea
          placeholder="补充说明（可选）"
          style={{ minHeight: 66 }}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <div className="dlg-row">
        <Field label="分组">
          <Select value={group} onChange={(event) => setGroup(event.target.value)}>
            {groupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="优先级">
          <Select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {(['high', 'mid', 'low'] as Priority[]).map((value) => (
              <option key={value} value={value}>
                {PRIORITY_TEXT[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="截止时间（可选）">
        <TextInput
          type="datetime-local"
          title="可选，精确到分钟"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
      </Field>

      {task && (
        <div className="task-time-info">
          创建时间：{formatDateTime(task.createdAt)}
          {task.completedAt ? ` · 完成时间：${formatDateTime(task.completedAt)}` : ''}
        </div>
      )}

      {error && <p className="dlg-error">{error}</p>}

      <div className="dlg-footer">
        <Button title="放弃编辑" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" title="保存任务" onClick={submit}>
          保存
        </Button>
      </div>
    </Modal>
  );
}
