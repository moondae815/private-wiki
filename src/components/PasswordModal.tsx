'use client'
import { useState, useEffect, useRef } from 'react'

interface PasswordModalProps {
  filename: string
  mode: 'unlock' | 'set' | 'unset'
  onSubmit: (password: string) => void
  onCancel: () => void
  error?: string
}

const LABELS: Record<PasswordModalProps['mode'], string> = {
  unlock: '비밀번호 입력',
  set: '비밀번호 설정',
  unset: '비공개 해제',
}

export function PasswordModal({
  filename,
  mode,
  onSubmit,
  onCancel,
  error,
}: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const handleSubmit = () => {
    if (mode === 'set' && password !== confirm) {
      setLocalError('비밀번호가 일치하지 않습니다')
      return
    }
    if (!password) return
    setLocalError('')
    onSubmit(password)
  }

  const displayError = error || localError

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
        <h2 className="text-sm font-semibold mb-1">{LABELS[mode]}</h2>
        <p className="text-xs text-gray-400 mb-4 truncate">{filename}</p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="비밀번호"
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {mode === 'set' && (
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="비밀번호 확인"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {displayError && (
          <p className="text-xs text-red-500 mb-2">{displayError}</p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!password}
            className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
