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

interface EditorProps {
  content: string
  filename: string
  type: 'notes' | 'todos'
  onSave?: (filename: string) => void
}

export function Editor({ content, filename, type, onSave }: EditorProps) {
  const saveFn = useCallback(
    async (markdownContent: string) => {
      await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdownContent }),
      })
      onSave?.(filename)
    },
    [filename, type, onSave]
  )

  const triggerSave = useAutoSave(saveFn, 2000)

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
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
