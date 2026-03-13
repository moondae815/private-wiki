import { format } from 'date-fns'

export function toFilename(title: string, date: Date = new Date()): string {
  const dateStr = format(date, 'yyyy-MM-dd')
  const safe = title.trim().replace(/\//g, '-')
  return `${dateStr}-${safe}.md`
}

export function extractTitle(filename: string): string {
  const withoutExt = filename.replace(/\.md$/, '')
  const match = withoutExt.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return match ? match[1] : withoutExt
}
