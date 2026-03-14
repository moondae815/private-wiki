'use client'
import { useState, useMemo } from 'react'
import { FileEntry, FileType } from '@/types'
import { SearchBar } from './SearchBar'
import { FileItem } from './FileItem'
import { TagTree } from './TagTree'
import { buildTagTree } from '@/lib/tagTree'
import { Dialog, DialogConfig } from './Dialog'

interface SidebarProps {
  files: FileEntry[]
  activeFilename: string | null
  type: FileType
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
  onSetPrivate?: (filename: string) => void
  onUnsetPrivate?: (filename: string) => void
}

export function Sidebar({ files, activeFilename, type, onSelect, onDelete, onRename, onSetPrivate, onUnsetPrivate }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogConfig | null>(null)

  const filtered = useMemo(() => {
    if (!search) return []
    return files.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
  }, [files, search])

  const tagTree = useMemo(() => buildTagTree(files), [files])

  return (
    <aside className="w-[260px] flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
      <SearchBar value={search} onChange={setSearch} />
      <div className="flex-1 overflow-y-auto py-1">
        {search ? (
          filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">검색 결과 없음</p>
          ) : (
            <div>
              {filtered.map((file) => (
                <FileItem
                  key={file.filename}
                  file={file}
                  isActive={file.filename === activeFilename}
                  onSelect={() => onSelect(file.filename)}
                  onDelete={() => {
                    setDialog({
                      type: 'confirm',
                      title: '파일 삭제',
                      message: `"${file.title}"을 삭제할까요?`,
                      danger: true,
                      onConfirm: () => { setDialog(null); onDelete(file.filename) },
                      onCancel: () => setDialog(null),
                    })
                  }}
                  onRename={(newTitle) => onRename(file.filename, newTitle)}
                  onSetPrivate={onSetPrivate ? () => onSetPrivate(file.filename) : undefined}
                  onUnsetPrivate={onUnsetPrivate ? () => onUnsetPrivate(file.filename) : undefined}
                />
              ))}
            </div>
          )
        ) : files.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">파일이 없습니다</p>
        ) : (
          <TagTree
            root={tagTree}
            activeFilename={activeFilename}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onSetPrivate={onSetPrivate}
            onUnsetPrivate={onUnsetPrivate}
          />
        )}
      </div>
      {dialog && <Dialog {...dialog} />}
    </aside>
  )
}
