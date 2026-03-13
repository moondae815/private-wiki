'use client'
import { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  const buttons = [
    { label: 'B', action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive('bold') },
    { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive('italic') },
    { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor.isActive('heading', { level: 1 }) },
    { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }) },
    { label: '≡', action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
    { label: '1.', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
    { label: '☑', action: () => editor.chain().focus().toggleTaskList().run(), isActive: editor.isActive('taskList') },
    { label: '```', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: editor.isActive('codeBlock') },
  ]

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onMouseDown={(e) => { e.preventDefault(); btn.action() }}
          className={`px-2 py-1 text-sm rounded transition-colors font-mono ${
            btn.isActive
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
