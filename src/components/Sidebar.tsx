'use client'
import { useState, useMemo } from 'react'
import { FileEntry, FileType } from '@/types'
import { SearchBar } from './SearchBar'
import { FileItem } from './FileItem'
import { TagFilter } from './TagFilter'

interface SidebarProps {
  files: FileEntry[]
  activeFilename: string | null
  type: FileType
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
}

export function Sidebar({ files, activeFilename, type, onSelect, onDelete, onRename }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    files.forEach((f) => f.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [files])

  const filtered = useMemo(() => {
    return files.filter((f) => {
      const matchSearch = f.title.toLowerCase().includes(search.toLowerCase())
      const matchTag = !activeTag || f.tags.includes(activeTag)
      return matchSearch && matchTag
    })
  }, [files, search, activeTag])

  return (
    <aside className="w-[260px] flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
      <SearchBar value={search} onChange={setSearch} />
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">
            {search ? '검색 결과 없음' : '파일이 없습니다'}
          </p>
        ) : (
          filtered.map((file) => (
            <FileItem
              key={file.filename}
              file={file}
              isActive={file.filename === activeFilename}
              onSelect={() => onSelect(file.filename)}
              onDelete={() => {
                if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
                  onDelete(file.filename)
                }
              }}
              onRename={(newTitle) => onRename(file.filename, newTitle)}
            />
          ))
        )}
      </div>
      <TagFilter tags={allTags} activeTag={activeTag} onTagClick={setActiveTag} />
    </aside>
  )
}
