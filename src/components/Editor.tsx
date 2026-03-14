'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useCallback } from 'react'
import { EditorToolbar } from './EditorToolbar'
import { useAutoSave } from '@/hooks/useAutoSave'
import { encrypt } from '@/lib/crypto'

interface EditorProps {
  content: string
  filename: string
  type: 'notes' | 'todos'
  password?: string
  onSave?: (filename: string) => void
  onFlushRef?: (flush: () => Promise<void>) => void
}

export function Editor({ content, filename, type, password, onSave, onFlushRef }: EditorProps) {
  const saveFn = useCallback(
    async (markdownContent: string) => {
      const body = password
        ? await encrypt(markdownContent, password)
        : markdownContent
      await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body }),
      })
      onSave?.(filename)
    },
    [filename, type, password, onSave]
  )

  const { trigger: triggerSave, flush } = useAutoSave(saveFn, 2000)

  // Expose flush to AppShell so "set private" can flush before re-encrypting
  useEffect(() => {
    onFlushRef?.(flush)
  }, [flush, onFlushRef])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '내용을 입력하세요...' }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-full p-6',
      },
    },
    onUpdate({ editor }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown()
      triggerSave(markdown)
    },
  })

  // Update content when file changes
  useEffect(() => {
    if (!editor) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as any).markdown.getMarkdown()
    if (current !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      {password && (
        <div className="flex items-center gap-1 px-4 py-1 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
          <span>🔒</span>
          <span>비공개 파일</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
