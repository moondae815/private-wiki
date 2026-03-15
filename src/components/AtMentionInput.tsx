'use client'
import { useRef, useEffect, useState, useMemo } from 'react'

interface Suggestion {
  label: string
  hint: string | null
}

function getSuggestions(): Suggestion[] {
  const today = new Date().toISOString().slice(0, 10)
  return [
    { label: `@due:${today}`, hint: '오늘' },
    { label: '@priority:high', hint: null },
    { label: '@priority:medium', hint: null },
    { label: '@priority:low', hint: null },
  ]
}

export interface AtMentionInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function AtMentionInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className,
  autoFocus,
}: AtMentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cursor, setCursor] = useState(value.length)
  const [dismissed, setDismissed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Sync cursor when value is changed externally (e.g., parent resets to "")
  useEffect(() => {
    if (cursor > value.length) {
      setCursor(value.length)
    }
  }, [value])

  const filtered = useMemo(() => {
    if (dismissed) return null
    const atIndex = value.lastIndexOf('@', cursor - 1)
    if (atIndex === -1) return null
    const tokenPart = value.slice(atIndex, cursor)
    if (/\s/.test(tokenPart)) return null
    const query = tokenPart.slice(1).toLowerCase()
    const matches = getSuggestions().filter((s) =>
      s.label.slice(1).toLowerCase().startsWith(query)
    )
    return matches.length > 0 ? { atIndex, matches } : null
  }, [value, cursor, dismissed])

  // query token이 바뀔 때마다 activeIndex 초기화
  const queryToken = filtered ? value.slice(filtered.atIndex, cursor) : null
  useEffect(() => {
    setActiveIndex(0)
  }, [queryToken])

  const insertSuggestion = (label: string) => {
    const newValue =
      value.slice(0, filtered!.atIndex) + label + ' ' + value.slice(cursor)
    setDismissed(true)
    onChange(newValue)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = e.target.selectionStart ?? e.target.value.length
    setCursor(pos)
    setDismissed(false)
    onChange(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(
          (i) => (i - 1 + filtered.matches.length) % filtered.matches.length
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertSuggestion(filtered.matches[activeIndex].label)
        return
      }
      if (e.key === 'Escape') {
        setDismissed(true)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
      />
      {filtered && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[240px] whitespace-nowrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-lg overflow-hidden">
          {filtered.matches.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center px-3 py-1.5 text-sm cursor-pointer ${
                i === activeIndex
                  ? 'bg-blue-100 dark:bg-blue-800/40'
                  : 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                insertSuggestion(s.label)
              }}
            >
              <span>{s.label}</span>
              {s.hint && (
                <span className="text-xs text-gray-400 ml-2">{s.hint}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
