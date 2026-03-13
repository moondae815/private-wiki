'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { FileType } from '@/types'

interface TopNavProps {
  onNewFile: () => void
}

export function TopNav({ onNewFile }: TopNavProps) {
  const pathname = usePathname()
  const active = pathname.startsWith('/todos') ? 'todos' : 'notes'

  const tab = (type: FileType, label: string) => (
    <Link
      href={`/${type}`}
      className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
        active === type
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <div className="flex items-center gap-2">
        {tab('notes', '📝 메모')}
        {tab('todos', '✅ Todo')}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={onNewFile}
          className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + 새 파일
        </button>
      </div>
    </header>
  )
}
