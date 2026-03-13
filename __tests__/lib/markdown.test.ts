import { extractTags, extractTodoMetadata } from '@/lib/markdown'

describe('extractTags', () => {
  it('extracts #tags from markdown content', () => {
    const content = '# 제목\n\n작업 내용 #work #personal\n\n더 많은 내용'
    expect(extractTags(content)).toEqual(['work', 'personal'])
  })

  it('deduplicates tags', () => {
    const content = '#work #work #personal'
    expect(extractTags(content)).toEqual(['work', 'personal'])
  })

  it('returns empty array if no tags', () => {
    expect(extractTags('No tags here')).toEqual([])
  })

  it('ignores markdown headings (#)', () => {
    expect(extractTags('# Heading\n## Sub')).toEqual([])
  })
})

describe('extractTodoMetadata', () => {
  it('extracts due date from @due: inline tag', () => {
    const item = '긴급 작업 @due:2026-03-20 @priority:high'
    const result = extractTodoMetadata(item)
    expect(result.due).toBe('2026-03-20')
    expect(result.priority).toBe('high')
  })

  it('returns null values if no metadata', () => {
    const result = extractTodoMetadata('일반 할 일')
    expect(result.due).toBeNull()
    expect(result.priority).toBeNull()
  })
})
