'use client'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative px-2 py-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="제목 검색..."
        className="w-full pl-7 pr-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
    </div>
  )
}
