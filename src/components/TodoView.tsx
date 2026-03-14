'use client'
import { useState, useCallback } from 'react'
import { parseMarkdownToItems, serializeItemsToMarkdown, TodoItem as TodoItemType } from '@/lib/todos'
import { TodoItem } from './TodoItem'
import { useAutoSave } from '@/hooks/useAutoSave'

interface TodoViewProps {
  content: string
  filename: string
  onSave?: (filename: string) => void
}

export function TodoView({ content, filename, onSave }: TodoViewProps) {
  const [items, setItems] = useState<TodoItemType[]>(() => parseMarkdownToItems(content))
  const [latestContent, setLatestContent] = useState(content)
  const [newTodoText, setNewTodoText] = useState('')

  const saveToServer = useCallback(
    async (markdown: string) => {
      await fetch(`/api/files/todos/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdown }),
      })
      onSave?.(filename)
    },
    [filename, onSave]
  )

  const triggerAutoSave = useAutoSave(saveToServer, 500)

  const applyChange = (newItems: TodoItemType[], immediate: boolean) => {
    const markdown = serializeItemsToMarkdown(newItems, latestContent)
    setItems(newItems)
    setLatestContent(markdown)
    if (immediate) {
      saveToServer(markdown).catch(console.error)
    } else {
      triggerAutoSave(markdown)
    }
  }

  const addTodo = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const newItem: TodoItemType = {
      id: crypto.randomUUID(),
      checked: false,
      text: trimmed,
      due: null,
      priority: null,
    }
    const newItems = [...items, newItem]
    applyChange(newItems, true)
    setNewTodoText('')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <TodoItem
            key={item.id}
            item={item}
            onChange={(updated) => {
              const newItems = items.map((it) => (it.id === updated.id ? updated : it))
              const immediate = updated.checked !== item.checked
              applyChange(newItems, immediate)
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 mt-2">
        <span className="text-gray-300 dark:text-gray-600 text-sm">+</span>
        <input
          type="text"
          placeholder="새 할 일 추가..."
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTodo(newTodoText) }}
          onBlur={() => addTodo(newTodoText)}
          className="flex-1 text-sm bg-transparent outline-none text-gray-500 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600"
        />
      </div>
    </div>
  )
}
