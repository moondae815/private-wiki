'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FileType, FileEntry } from '@/types'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { Editor } from './Editor'
import { TodoView } from './TodoView'
import { PasswordModal } from './PasswordModal'
import { Dialog, DialogConfig } from './Dialog'
import { useFiles } from '@/hooks/useFiles'
import { encrypt, decrypt, CryptoError } from '@/lib/crypto'

type ModalState =
  | { mode: 'unlock'; file: FileEntry }
  | { mode: 'set'; file: FileEntry }
  | { mode: 'unset'; file: FileEntry }
  | null

interface AppShellProps {
  type: FileType
}

export function AppShell({ type }: AppShellProps) {
  const { files, loading, refresh, createFile, deleteFile, renameFile } = useFiles(type)
  const [activeFilename, setActiveFilenameRaw] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState<string>('')
  const [activePassword, setActivePassword] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [modalError, setModalError] = useState<string | undefined>()
  const [dialog, setDialog] = useState<DialogConfig | null>(null)
  // Ref used by "set private" flow to flush in-flight auto-save
  const flushRef = useRef<(() => Promise<void>) | null>(null)

  // Clear password whenever file changes
  const setActiveFilename = useCallback((filename: string | null) => {
    setActiveFilenameRaw(filename)
    setActivePassword(null)
    setActiveContent('')
  }, [])

  // Fetch content — skip private files (they require password first)
  useEffect(() => {
    if (!activeFilename) return
    const file = files.find((f) => f.filename === activeFilename)
    if (!file || file.isPrivate) return  // private: wait for password
    fetch(`/api/files/${type}/${encodeURIComponent(activeFilename)}`)
      .then((r) => r.json())
      .then((data) => setActiveContent(data.content ?? ''))
  }, [activeFilename, type, files])

  // Auto-select first file on initial load
  useEffect(() => {
    if (!loading && files.length > 0 && !activeFilename) {
      setActiveFilenameRaw(files[0].filename)
    }
  }, [loading, files, activeFilename])

  // ── File selection ──────────────────────────────────────────────
  const handleSelect = (filename: string) => {
    const file = files.find((f) => f.filename === filename)
    if (!file) return
    setActiveFilename(filename)
    if (file.isPrivate) {
      setModal({ mode: 'unlock', file })
      setModalError(undefined)
    }
  }

  // ── Modal submit ────────────────────────────────────────────────
  const handleModalSubmit = async (password: string) => {
    if (!modal) return
    setModalError(undefined)

    if (modal.mode === 'unlock') {
      try {
        const res = await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`)
        const { content } = await res.json()
        const plaintext = await decrypt(content, password)
        setActiveContent(plaintext)
        setActivePassword(password)
        setModal(null)
      } catch (err) {
        if (err instanceof CryptoError && err.code === 'corrupt_format') {
          setModalError('파일이 손상되었습니다')
        } else {
          setModalError('비밀번호가 올바르지 않습니다')
        }
      }
    }

    if (modal.mode === 'set') {
      try {
        // Await flush so any pending auto-save lands before we re-encrypt
        await flushRef.current?.()
        // Use activeContent (already in state — no extra fetch needed)
        const blob = await encrypt(activeContent, password)
        await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: blob }),
        })
        setActivePassword(password)
        setModal(null)
        refresh()
      } catch {
        setModalError('암호화 중 오류가 발생했습니다')
      }
    }

    if (modal.mode === 'unset') {
      try {
        const res = await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`)
        const { content } = await res.json()
        const plaintext = await decrypt(content, password)
        await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: plaintext }),
        })
        setActivePassword(null)
        setModal(null)
        // Update displayed content with plaintext
        setActiveContent(plaintext)
        refresh()
      } catch (err) {
        if (err instanceof CryptoError && err.code === 'corrupt_format') {
          setModalError('파일이 손상되었습니다')
        } else {
          setModalError('비밀번호가 올바르지 않습니다')
        }
      }
    }
  }

  // Stable ref so Editor's useEffect doesn't re-fire on every render
  const handleFlushRef = useCallback((flush: () => Promise<void>) => {
    flushRef.current = flush
  }, [])

  // ── CRUD handlers ───────────────────────────────────────────────
  const handleNewFile = () => {
    setDialog({
      type: 'prompt',
      title: '새 파일 제목',
      placeholder: '제목을 입력하세요',
      onSubmit: async (title) => {
        setDialog(null)
        const filename = await createFile(title)
        if (filename) setActiveFilename(filename)
      },
      onCancel: () => setDialog(null),
    })
  }

  const handleDelete = async (filename: string) => {
    await deleteFile(filename)
    if (filename === activeFilename) {
      setActiveFilename(files.find((f) => f.filename !== filename)?.filename ?? null)
    }
  }

  const handleRename = async (filename: string, newTitle: string) => {
    const newFilename = await renameFile(filename, newTitle)
    if (newFilename && filename === activeFilename) {
      setActiveFilenameRaw(newFilename)
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  const activeFile = files.find((f) => f.filename === activeFilename)
  const isActivePrivate = activeFile?.isPrivate ?? false
  const showLockedPlaceholder = isActivePrivate && !activePassword

  return (
    <div className="flex flex-col h-screen">
      <TopNav onNewFile={handleNewFile} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          files={files}
          activeFilename={activeFilename}
          type={type}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onRename={handleRename}
          onSetPrivate={type === 'notes'
            ? (filename) => {
                const file = files.find((f) => f.filename === filename)
                if (file) { setModal({ mode: 'set', file }); setModalError(undefined) }
              }
            : undefined}
          onUnsetPrivate={type === 'notes'
            ? (filename) => {
                const file = files.find((f) => f.filename === filename)
                if (file) { setModal({ mode: 'unset', file }); setModalError(undefined) }
              }
            : undefined}
        />
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {showLockedPlaceholder ? (
            <div
              className="flex items-center justify-center h-full text-gray-400 cursor-pointer"
              onClick={() => activeFile && setModal({ mode: 'unlock', file: activeFile })}
            >
              <div className="text-center">
                <p className="text-4xl mb-4">🔒</p>
                <p className="text-sm">비공개 파일입니다. 클릭하여 비밀번호를 입력하세요.</p>
              </div>
            </div>
          ) : activeFilename ? (
            type === 'todos' ? (
              <TodoView
                key={activeFilename}
                content={activeContent}
                filename={activeFilename}
                onSave={refresh}
              />
            ) : (
              <Editor
                key={activeFilename}
                content={activeContent}
                filename={activeFilename}
                type={type}
                password={activePassword ?? undefined}
                onSave={refresh}
                onFlushRef={handleFlushRef}
              />
            )
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

      {modal && (
        <PasswordModal
          filename={modal.file.filename}
          mode={modal.mode}
          onSubmit={handleModalSubmit}
          onCancel={() => setModal(null)}
          error={modalError}
        />
      )}

      {dialog && <Dialog {...dialog} />}
    </div>
  )
}
