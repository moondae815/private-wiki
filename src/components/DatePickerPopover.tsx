'use client'
import { useState, useRef, useEffect } from 'react'

interface DatePickerPopoverProps {
  value: string | null   // "YYYY-MM-DD" or null
  onChange: (value: string | null) => void
}

function isOverdue(date: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return date < today
}

export function DatePickerPopover({ value, onChange }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [textInput, setTextInput] = useState(value ?? '')
  const ref = useRef<HTMLDivElement>(null)

  // 팝오버가 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (open) setTextInput(value ?? '')
  }, [open, value])

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleTextChange = (raw: string) => {
    setTextInput(raw)
    // 완전한 YYYY-MM-DD 형식일 때만 onChange 호출 (부분 입력 시 date input 건드리지 않음)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      onChange(raw)
    }
  }

  const handleDateChange = (v: string) => {
    setTextInput(v)
    onChange(v || null)
  }

  const handleRemove = () => {
    onChange(null)
    setOpen(false)
  }

  const badgeClass = value
    ? isOverdue(value)
      ? 'text-xs px-2 py-0.5 rounded-full cursor-pointer bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : 'text-xs px-2 py-0.5 rounded-full cursor-pointer bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    : 'text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={badgeClass}
        onClick={() => setOpen((o) => !o)}
      >
        {value ?? '+ 날짜'}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-[200px]">
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={textInput}
            onChange={(e) => handleTextChange(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          />
          <input
            type="date"
            value={textInput.match(/^\d{4}-\d{2}-\d{2}$/) ? textInput : ''}
            onChange={(e) => handleDateChange(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          />
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700 text-left"
            >
              날짜 제거
            </button>
          )}
        </div>
      )}
    </div>
  )
}
