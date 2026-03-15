'use client'
import { useState } from 'react'
import type { TodoItem as TodoItemType } from '@/lib/todos'
import { extractTodoMetadata } from '@/lib/markdown'
import { DatePickerPopover } from './DatePickerPopover'
import { PriorityDropdown } from './PriorityDropdown'
import { AtMentionInput } from './AtMentionInput'

interface TodoItemProps {
  item: TodoItemType
  onChange: (updated: TodoItemType) => void
}

export function TodoItem({ item, onChange }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)

  const update = (patch: Partial<TodoItemType>) =>
    onChange({ ...item, ...patch })

  const commitText = () => {
    setEditing(false)
    const trimmed = editText.trim()
    const metadata = extractTodoMetadata(trimmed)
    const cleanText = trimmed
      .replace(/@due:\S+/g, '')
      .replace(/@priority:\S+/g, '')
      .trim()
    const newDue = metadata.due !== null ? metadata.due : item.due
    const newPriority = metadata.priority !== null ? metadata.priority : item.priority
    if (cleanText !== item.text || newDue !== item.due || newPriority !== item.priority) {
      onChange({ ...item, text: cleanText, due: newDue, priority: newPriority })
    }
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${item.checked ? 'opacity-60' : ''}`}>
      {/* 체크박스 */}
      <input
        type="checkbox"
        checked={item.checked}
        onChange={(e) => update({ checked: e.target.checked })}
        className="w-4 h-4 rounded shrink-0 cursor-pointer accent-blue-500"
      />

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <AtMentionInput
            autoFocus
            value={editText}
            onChange={setEditText}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText()
              if (e.key === 'Escape') { setEditing(false); setEditText(item.text) }
            }}
            className="w-full text-sm bg-transparent border-b border-blue-400 outline-none text-gray-800 dark:text-gray-200"
          />
        ) : (
          <span
            onDoubleClick={() => { setEditing(true); setEditText(item.text) }}
            title="더블클릭하여 편집"
            className={`group/text relative inline-flex items-center gap-1 text-sm cursor-text select-none ${item.checked ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
          >
            {item.text || <span className="text-gray-300 dark:text-gray-600 italic">빈 항목</span>}
            <span className="opacity-0 group-hover/text:opacity-40 transition-opacity text-gray-400 text-xs">✎</span>
          </span>
        )}
      </div>

      {/* 메타데이터 배지 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <DatePickerPopover
          value={item.due}
          onChange={(due) => update({ due })}
        />
        <PriorityDropdown
          value={item.priority}
          onChange={(priority) => update({ priority })}
        />
      </div>
    </div>
  )
}
