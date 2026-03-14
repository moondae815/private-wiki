'use client'
import { FileEntry } from '@/types'
import { format } from 'date-fns'

interface FileItemProps {
  file: FileEntry
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newTitle: string) => void
  onSetPrivate?: () => void
  onUnsetPrivate?: () => void
  hideTags?: boolean
}

export function FileItem({
  file,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onSetPrivate,
  onUnsetPrivate,
  hideTags,
}: FileItemProps) {
  const handleRename = () => {
    const newTitle = window.prompt('새 제목:', file.title)
    if (newTitle && newTitle.trim()) onRename(newTitle.trim())
  }

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 cursor-pointer rounded mx-1 ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {file.isPrivate && <span className="text-sm shrink-0">🔒</span>}
          <p className={`text-sm font-medium truncate ${file.isPrivate ? 'blur-sm select-none' : ''}`}>
            {file.title}
          </p>
        </div>
        <p className="text-xs text-gray-400">
          {format(new Date(file.updatedAt), 'MM/dd')}
          {!hideTags && !file.isPrivate && file.tags.length > 0 && ` · ${file.tags.map((t) => `#${t}`).join(' ')}`}
        </p>
      </div>
      <div className="hidden group-hover:flex items-center gap-1 ml-2 shrink-0">
        {!file.isPrivate && onSetPrivate && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetPrivate() }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
            title="비공개로 설정"
          >🔒</button>
        )}
        {file.isPrivate && onUnsetPrivate && (
          <button
            onClick={(e) => { e.stopPropagation(); onUnsetPrivate() }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
            title="비공개 해제"
          >🔓</button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handleRename() }}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
          title="이름 변경"
        >✏️</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-xs"
          title="삭제"
        >🗑️</button>
      </div>
    </div>
  )
}
