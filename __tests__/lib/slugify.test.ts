import { toFilename, extractTitle } from '@/lib/slugify'

describe('toFilename', () => {
  it('generates YYYY-MM-DD-slug.md format', () => {
    const result = toFilename('회의록', new Date('2026-03-13'))
    expect(result).toBe('2026-03-13-회의록.md')
  })

  it('trims whitespace from title', () => {
    const result = toFilename('  My Note  ', new Date('2026-03-13'))
    expect(result).toBe('2026-03-13-My Note.md')
  })

  it('replaces slashes to avoid path traversal', () => {
    const result = toFilename('a/b', new Date('2026-03-13'))
    expect(result).toBe('2026-03-13-a-b.md')
  })
})

describe('extractTitle', () => {
  it('extracts title from YYYY-MM-DD-title.md filename', () => {
    expect(extractTitle('2026-03-13-회의록.md')).toBe('회의록')
  })

  it('returns filename without extension if no date prefix', () => {
    expect(extractTitle('untitled.md')).toBe('untitled')
  })
})
