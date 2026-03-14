'use client'
import { useState, useEffect, useRef } from 'react'

export type DialogConfig =
  | {
      type: 'prompt'
      title: string
      placeholder?: string
      defaultValue?: string
      onSubmit: (value: string) => void
      onCancel: () => void
    }
  | {
      type: 'confirm'
      title: string
      message: string
      danger?: boolean
      onConfirm: () => void
      onCancel: () => void
    }

export function Dialog(props: DialogConfig) {
  const [value, setValue] = useState(
    props.type === 'prompt' ? (props.defaultValue ?? '') : ''
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const onCancelRef = useRef(props.onCancel)
  useEffect(() => { onCancelRef.current = props.onCancel })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleSubmit = () => {
    if (props.type === 'prompt') {
      if (!value.trim()) return
      props.onSubmit(value.trim())
    } else {
      props.onConfirm()
    }
  }

  const isPrompt = props.type === 'prompt'
  const isDanger = props.type === 'confirm' && props.danger

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
        <h2 className="text-sm font-semibold mb-4">{props.title}</h2>

        {props.type === 'confirm' && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{props.message}</p>
        )}

        {isPrompt && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={props.placeholder}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-transparent mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPrompt && !value.trim()}
            className={`text-sm px-3 py-1.5 rounded text-white disabled:opacity-40 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
