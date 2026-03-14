'use client'
import { useState, useRef, useEffect } from 'react'
import type { TodoItem } from '@/lib/todos'

type Priority = TodoItem['priority']

const PRIORITY_LABELS: Record<NonNullable<Priority>, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}

const PRIORITY_COLORS: Record<NonNullable<Priority>, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

interface PriorityDropdownProps {
  value: Priority
  onChange: (value: Priority) => void
}

export function PriorityDropdown({ value, onChange }: PriorityDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const triggerClass = value
    ? `${PRIORITY_COLORS[value]} text-xs px-2 py-0.5 rounded-full cursor-pointer`
    : 'text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? PRIORITY_LABELS[value] : '+ 우선순위'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[80px]">
          {(['high', 'medium', 'low'] as NonNullable<Priority>[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${value === p ? 'font-semibold' : ''}`}
              onClick={() => { onChange(p); setOpen(false) }}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              {PRIORITY_LABELS[p]}
            </button>
          ))}
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => { onChange(null); setOpen(false) }}
          >
            없음
          </button>
        </div>
      )}
    </div>
  )
}
