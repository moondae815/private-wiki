'use client'

interface TagFilterProps {
  tags: string[]
  activeTag: string | null
  onTagClick: (tag: string | null) => void
}

export function TagFilter({ tags, activeTag, onTagClick }: TagFilterProps) {
  if (tags.length === 0) return null

  return (
    <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-400 uppercase mb-2">태그</p>
      <div className="flex flex-wrap gap-1">
        {activeTag && (
          <button
            onClick={() => onTagClick(null)}
            className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
          >
            전체
          </button>
        )}
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag === activeTag ? null : tag)}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              tag === activeTag
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  )
}
