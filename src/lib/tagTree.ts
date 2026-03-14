import { FileEntry } from '@/types'

export interface TagNode {
  name: string
  fullPath: string
  children: Map<string, TagNode>
  files: FileEntry[]
}

export interface TagTreeRoot {
  roots: Map<string, TagNode>
  untagged: FileEntry[]
}

export function buildTagTree(files: FileEntry[]): TagTreeRoot {
  const roots = new Map<string, TagNode>()
  const untagged: FileEntry[] = []

  for (const file of files) {
    if (file.tags.length === 0) {
      untagged.push(file)
      continue
    }

    for (const tag of file.tags) {
      const segments = tag.split('/').filter(Boolean)
      if (segments.length === 0) continue

      let currentMap = roots
      let pathSoFar = ''

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment

        if (!currentMap.has(segment)) {
          currentMap.set(segment, {
            name: segment,
            fullPath: pathSoFar,
            children: new Map(),
            files: [],
          })
        }

        const node = currentMap.get(segment)!

        if (i === segments.length - 1) {
          // leaf node — place the file here
          node.files.push(file)
        }

        currentMap = node.children
      }
    }
  }

  return { roots, untagged }
}
