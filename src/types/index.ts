export type FileType = 'notes' | 'todos'

export interface FileEntry {
  filename: string        // e.g. "2026-03-13-회의록.md"
  title: string           // e.g. "회의록"
  type: FileType
  tags: string[]          // extracted #tags
  createdAt: string       // ISO date string
  updatedAt: string       // ISO date string
  isPrivate: boolean
}

export interface SearchResult {
  filename: string
  title: string
  type: FileType
}

export interface CreateFileRequest {
  title: string
  type: FileType
}

export interface UpdateFileRequest {
  content: string
}
