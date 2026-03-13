import fs from 'fs/promises'
import path from 'path'
import { FileEntry, FileType } from '@/types'
import { extractTags } from '@/lib/markdown'
import { extractTitle } from '@/lib/slugify'

export const DATA_DIR = path.join(process.cwd(), 'data')

export async function listFiles(type: FileType): Promise<FileEntry[]> {
  const dir = path.join(DATA_DIR, type)
  const names = await fs.readdir(dir)
  const mdFiles = names.filter((n) => n.endsWith('.md'))

  const entries = await Promise.all(
    mdFiles.map(async (filename) => {
      const filePath = path.join(dir, filename)
      const [stat, content] = await Promise.all([
        fs.stat(filePath),
        fs.readFile(filePath, 'utf-8'),
      ])
      return {
        filename,
        title: extractTitle(filename),
        type,
        tags: extractTags(content),
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      } as FileEntry
    })
  )

  return entries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function readFile(type: FileType, filename: string): Promise<string> {
  const filePath = path.join(DATA_DIR, type, filename)
  return fs.readFile(filePath, 'utf-8')
}

export async function writeFile(
  type: FileType,
  filename: string,
  content: string
): Promise<void> {
  const filePath = path.join(DATA_DIR, type, filename)
  await fs.writeFile(filePath, content, 'utf-8')
}

export async function deleteFile(type: FileType, filename: string): Promise<void> {
  const filePath = path.join(DATA_DIR, type, filename)
  await fs.unlink(filePath)
}

export async function renameFile(
  type: FileType,
  oldFilename: string,
  newFilename: string
): Promise<void> {
  const dir = path.join(DATA_DIR, type)
  await fs.rename(path.join(dir, oldFilename), path.join(dir, newFilename))
}
