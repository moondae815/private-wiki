'use client'
import { useState, useEffect } from 'react'
import { FileType } from '@/types'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { Editor } from './Editor'
import { useFiles } from '@/hooks/useFiles'

interface AppShellProps {
  type: FileType
}

export function AppShell({ type }: AppShellProps) {
  const { files, loading, refresh, createFile, deleteFile, renameFile } = useFiles(type)
  const [activeFilename, setActiveFilename] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState<string>('')

  useEffect(() => {
    if (!activeFilename) return
    fetch(`/api/files/${type}/${encodeURIComponent(activeFilename)}`)
      .then((r) => r.json())
      .then((data) => setActiveContent(data.content ?? ''))
  }, [activeFilename, type])

  useEffect(() => {
    if (!loading && files.length > 0 && !activeFilename) {
      setActiveFilename(files[0].filename)
    }
  }, [loading, files, activeFilename])

  const handleNewFile = async () => {
    const title = window.prompt('새 파일 제목:')
    if (!title?.trim()) return
    const filename = await createFile(title.trim())
    if (filename) setActiveFilename(filename)
  }

  const handleDelete = async (filename: string) => {
    await deleteFile(filename)
    if (filename === activeFilename) {
      setActiveFilename(files.find((f) => f.filename !== filename)?.filename ?? null)
      setActiveContent('')
    }
  }

  const handleRename = async (filename: string, newTitle: string) => {
    const newFilename = await renameFile(filename, newTitle)
    if (newFilename && filename === activeFilename) {
      setActiveFilename(newFilename)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <TopNav onNewFile={handleNewFile} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          files={files}
          activeFilename={activeFilename}
          type={type}
          onSelect={(filename) => setActiveFilename(filename)}
          onDelete={handleDelete}
          onRename={handleRename}
        />
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {activeFilename ? (
            <Editor
              key={activeFilename}
              content={activeContent}
              filename={activeFilename}
              type={type}
              onSave={refresh}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-4">{type === 'notes' ? '📝' : '✅'}</p>
                <p className="text-sm">파일을 선택하거나 새 파일을 만드세요</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
