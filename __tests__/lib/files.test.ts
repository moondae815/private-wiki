import fs from 'fs/promises'
import path from 'path'

jest.mock('fs/promises')
const mockFs = fs as jest.Mocked<typeof fs>

import { listFiles, readFile, writeFile, deleteFile, DATA_DIR } from '@/lib/files'

describe('listFiles', () => {
  it('returns FileEntry array with isPrivate: false for plain files', async () => {
    mockFs.readdir.mockResolvedValue(['2026-03-13-메모.md'] as any)
    mockFs.stat.mockResolvedValue({ mtime: new Date('2026-03-13'), birthtime: new Date('2026-03-13') } as any)
    mockFs.readFile.mockResolvedValue('# 메모\n\n내용 #work' as any)

    const result = await listFiles('notes')
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('2026-03-13-메모.md')
    expect(result[0].tags).toContain('work')
    expect(result[0].isPrivate).toBe(false)
  })

  it('sets isPrivate: true and tags: [] for PRIVATE: files', async () => {
    mockFs.readdir.mockResolvedValue(['2026-03-13-비밀.md'] as any)
    mockFs.stat.mockResolvedValue({ mtime: new Date('2026-03-13'), birthtime: new Date('2026-03-13') } as any)
    mockFs.readFile.mockResolvedValue('PRIVATE:abc:def:ghi' as any)

    const result = await listFiles('notes')
    expect(result[0].isPrivate).toBe(true)
    expect(result[0].tags).toEqual([])
  })
})

describe('readFile', () => {
  it('returns file content as string', async () => {
    mockFs.readFile.mockResolvedValue('# Hello' as any)
    const content = await readFile('notes', '2026-03-13-test.md')
    expect(content).toBe('# Hello')
  })
})

describe('writeFile', () => {
  it('writes content to the correct path', async () => {
    mockFs.writeFile.mockResolvedValue(undefined)
    await writeFile('notes', '2026-03-13-test.md', '# Hello')
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      path.join(DATA_DIR, 'notes', '2026-03-13-test.md'),
      '# Hello',
      'utf-8'
    )
  })
})

describe('deleteFile', () => {
  it('deletes the file at the correct path', async () => {
    mockFs.unlink.mockResolvedValue(undefined)
    await deleteFile('notes', '2026-03-13-test.md')
    expect(mockFs.unlink).toHaveBeenCalledWith(
      path.join(DATA_DIR, 'notes', '2026-03-13-test.md')
    )
  })
})
