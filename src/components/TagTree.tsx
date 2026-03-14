'use client'
import { useState } from 'react'
import { TagNode, TagTreeRoot } from '@/lib/tagTree'
import { FileItem } from './FileItem'

interface TagTreeProps {
  root: TagTreeRoot
  activeFilename: string | null
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
  onSetPrivate?: (filename: string) => void
  onUnsetPrivate?: (filename: string) => void
}

interface TagNodeRowProps {
  node: TagNode
  depth: number
  activeFilename: string | null
  collapsed: Set<string>
  onToggle: (fullPath: string) => void
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
  onSetPrivate?: (filename: string) => void
  onUnsetPrivate?: (filename: string) => void
}

function TagNodeRow({
  node,
  depth,
  activeFilename,
  collapsed,
  onToggle,
  onSelect,
  onDelete,
  onRename,
  onSetPrivate,
  onUnsetPrivate,
}: TagNodeRowProps) {
  const isCollapsed = collapsed.has(node.fullPath)
  const sortedChildren = [...node.children.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const sortedFiles = [...node.files].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div>
      {/* Folder header row */}
      <button
        onClick={() => onToggle(node.fullPath)}
        className="w-full flex items-center gap-1 pr-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded mx-1"
        style={{ paddingLeft: depth * 16 + 8 + 'px' }}
      >
        <span className="shrink-0">{isCollapsed ? '▶' : '▼'}</span>
        <span className="truncate">{node.name}</span>
      </button>

      {/* Children (folders first, then files) */}
      {!isCollapsed && (
        <>
          {sortedChildren.map((child) => (
            <TagNodeRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              activeFilename={activeFilename}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onSetPrivate={onSetPrivate}
              onUnsetPrivate={onUnsetPrivate}
            />
          ))}
          {sortedFiles.map((file) => (
            <div key={file.filename} style={{ paddingLeft: (depth + 1) * 16 + 'px' }}>
              <FileItem
                file={file}
                isActive={file.filename === activeFilename}
                onSelect={() => onSelect(file.filename)}
                onDelete={() => {
                  if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
                    onDelete(file.filename)
                  }
                }}
                onRename={(newTitle) => onRename(file.filename, newTitle)}
                onSetPrivate={onSetPrivate ? () => onSetPrivate(file.filename) : undefined}
                onUnsetPrivate={onUnsetPrivate ? () => onUnsetPrivate(file.filename) : undefined}
                hideTags
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export function TagTree({ root, activeFilename, onSelect, onDelete, onRename, onSetPrivate, onUnsetPrivate }: TagTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapsed = (fullPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(fullPath)) {
        next.delete(fullPath)
      } else {
        next.add(fullPath)
      }
      return next
    })
  }

  const sortedRoots = [...root.roots.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  return (
    <div className="py-1">
      {/* Untagged files at the top */}
      {root.untagged.length > 0 && (
        <div>
          <p
            className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase"
          >
            태그 없음
          </p>
          {root.untagged.map((file) => (
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
              onSetPrivate={onSetPrivate ? () => onSetPrivate(file.filename) : undefined}
              onUnsetPrivate={onUnsetPrivate ? () => onUnsetPrivate(file.filename) : undefined}
            />
          ))}
        </div>
      )}

      {/* Tag tree */}
      {sortedRoots.map((node) => (
        <TagNodeRow
          key={node.fullPath}
          node={node}
          depth={0}
          activeFilename={activeFilename}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          onSetPrivate={onSetPrivate}
          onUnsetPrivate={onUnsetPrivate}
        />
      ))}
    </div>
  )
}
