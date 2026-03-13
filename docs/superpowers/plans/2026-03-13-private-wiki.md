# Private Wiki Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js web app for writing markdown-based memos and todos, stored as .md files on the local filesystem.

**Architecture:** Next.js 14 App Router + TipTap WYSIWYG editor. API Routes handle all filesystem I/O (read/write/delete .md files in `data/notes/` and `data/todos/`). Client components manage editor state with 2s debounce auto-save. Dark mode via `next-themes`.

**Tech Stack:** Next.js 14, React 18, TypeScript, TipTap + tiptap-markdown, Tailwind CSS, gray-matter, next-themes, pnpm

---

## File Map

```
private-wiki/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                  # Root layout — ThemeProvider, font
│   │   ├── page.tsx                    # Redirect → /notes
│   │   ├── notes/page.tsx              # Notes page (AppShell)
│   │   ├── todos/page.tsx              # Todos page (AppShell)
│   │   └── api/
│   │       ├── files/route.ts          # GET list, POST create
│   │       ├── files/[type]/[filename]/route.ts  # GET, PUT, DELETE
│   │       └── search/route.ts         # GET ?q=&type=
│   ├── components/
│   │   ├── AppShell.tsx                # Sidebar + editor layout
│   │   ├── TopNav.tsx                  # Notes/Todos tabs + dark toggle + new file
│   │   ├── Sidebar.tsx                 # FileList + TagFilter + SearchBar
│   │   ├── FileItem.tsx                # Single file row (name, date, rename, delete)
│   │   ├── TagFilter.tsx               # Clickable tag chips
│   │   ├── SearchBar.tsx               # Controlled search input
│   │   ├── Editor.tsx                  # TipTap WYSIWYG wrapper
│   │   ├── EditorToolbar.tsx           # Bold/italic/heading/list toolbar
│   │   └── ThemeToggle.tsx             # Sun/moon icon button
│   ├── lib/
│   │   ├── files.ts                    # Server: fs CRUD helpers
│   │   ├── markdown.ts                 # Tag extraction, todo metadata parsing
│   │   └── slugify.ts                  # Filename → YYYY-MM-DD-slug.md
│   ├── hooks/
│   │   ├── useAutoSave.ts              # 2s debounce → calls save API
│   │   └── useFiles.ts                 # SWR-style file list + refetch
│   └── types/index.ts                  # FileEntry, SearchResult, FileType
├── data/
│   ├── notes/                          # .md memo files
│   └── todos/                          # .md todo files
├── __tests__/
│   ├── lib/slugify.test.ts
│   ├── lib/markdown.test.ts
│   ├── lib/files.test.ts
│   └── hooks/useAutoSave.test.ts
├── jest.config.ts
├── jest.setup.ts
└── next.config.ts
```

---

## Chunk 1: Project Setup + Utilities

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json` (auto-generated)
- Create: `jest.config.ts`, `jest.setup.ts`
- Create: `data/notes/.gitkeep`, `data/todos/.gitkeep`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd C:/git-root/private-wiki
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

When prompted:
- Would you like to use Turbopack? → **No**
- Accept all other defaults

- [ ] **Step 2: Install dependencies**

```bash
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-placeholder tiptap-markdown
pnpm add gray-matter next-themes date-fns
pnpm add -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest ts-jest
```

- [ ] **Step 3: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}

export default createJestConfig(config)
```

- [ ] **Step 4: Create jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create data directories**

```bash
mkdir -p C:/git-root/private-wiki/data/notes
mkdir -p C:/git-root/private-wiki/data/todos
echo "" > C:/git-root/private-wiki/data/notes/.gitkeep
echo "" > C:/git-root/private-wiki/data/todos/.gitkeep
```

- [ ] **Step 6: Verify dev server starts**

```bash
pnpm dev
```

Expected: Next.js server running at `http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js project with TipTap and test setup"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write types**

```typescript
// src/types/index.ts
export type FileType = 'notes' | 'todos'

export interface FileEntry {
  filename: string        // e.g. "2026-03-13-회의록.md"
  title: string           // e.g. "회의록"
  type: FileType
  tags: string[]          // extracted #tags
  createdAt: string       // ISO date string
  updatedAt: string       // ISO date string
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: slugify Utility

**Files:**
- Create: `src/lib/slugify.ts`
- Test: `__tests__/lib/slugify.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/slugify.test.ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm jest __tests__/lib/slugify.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement slugify.ts**

```typescript
// src/lib/slugify.ts
import { format } from 'date-fns'

export function toFilename(title: string, date: Date = new Date()): string {
  const dateStr = format(date, 'yyyy-MM-dd')
  const safe = title.trim().replace(/\//g, '-')
  return `${dateStr}-${safe}.md`
}

export function extractTitle(filename: string): string {
  const withoutExt = filename.replace(/\.md$/, '')
  // Remove YYYY-MM-DD- prefix if present
  const match = withoutExt.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return match ? match[1] : withoutExt
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm jest __tests__/lib/slugify.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slugify.ts __tests__/lib/slugify.test.ts
git commit -m "feat: add slugify utility with tests"
```

---

### Task 4: Markdown Utility (Tag Extraction)

**Files:**
- Create: `src/lib/markdown.ts`
- Test: `__tests__/lib/markdown.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/markdown.test.ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm jest __tests__/lib/markdown.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement markdown.ts**

```typescript
// src/lib/markdown.ts
export function extractTags(content: string): string[] {
  // Match #tag not preceded by space-only start of line (to skip headings)
  const matches = content.match(/(?<!\n)(?<=\s|^)#([a-zA-Z가-힣0-9_-]+)/g)
  if (!matches) return []
  const tags = matches.map((t) => t.slice(1))
  return [...new Set(tags)]
}

export interface TodoMetadata {
  due: string | null
  priority: 'high' | 'medium' | 'low' | null
}

export function extractTodoMetadata(itemText: string): TodoMetadata {
  const dueMatch = itemText.match(/@due:(\d{4}-\d{2}-\d{2})/)
  const priorityMatch = itemText.match(/@priority:(high|medium|low)/)
  return {
    due: dueMatch ? dueMatch[1] : null,
    priority: priorityMatch ? (priorityMatch[1] as TodoMetadata['priority']) : null,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm jest __tests__/lib/markdown.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.ts __tests__/lib/markdown.test.ts
git commit -m "feat: add markdown utilities (tag extraction, todo metadata)"
```

---

### Task 5: File System Library

**Files:**
- Create: `src/lib/files.ts`
- Test: `__tests__/lib/files.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/files.test.ts
import fs from 'fs/promises'
import path from 'path'

// Mock the fs module
jest.mock('fs/promises')
const mockFs = fs as jest.Mocked<typeof fs>

import { listFiles, readFile, writeFile, deleteFile, DATA_DIR } from '@/lib/files'

describe('listFiles', () => {
  it('returns FileEntry array for existing .md files', async () => {
    mockFs.readdir.mockResolvedValue(['2026-03-13-메모.md'] as any)
    mockFs.stat.mockResolvedValue({ mtime: new Date('2026-03-13'), birthtime: new Date('2026-03-13') } as any)
    mockFs.readFile.mockResolvedValue('# 메모\n\n내용 #work' as any)

    const result = await listFiles('notes')
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('2026-03-13-메모.md')
    expect(result[0].tags).toContain('work')
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm jest __tests__/lib/files.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement files.ts**

```typescript
// src/lib/files.ts
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
      } satisfies FileEntry
    })
  )

  // Sort newest first
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm jest __tests__/lib/files.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/files.ts __tests__/lib/files.test.ts
git commit -m "feat: add file system library with CRUD helpers"
```

---

## Chunk 2: API Routes

### Task 6: File List + Create API

**Files:**
- Create: `src/app/api/files/route.ts`

- [ ] **Step 1: Implement route**

```typescript
// src/app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { listFiles, writeFile } from '@/lib/files'
import { toFilename } from '@/lib/slugify'
import { FileType, CreateFileRequest } from '@/types'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') as FileType
  if (type !== 'notes' && type !== 'todos') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  try {
    const files = await listFiles(type)
    return NextResponse.json(files)
  } catch {
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body: CreateFileRequest = await req.json()
  const { title, type } = body

  if (!title || !type) {
    return NextResponse.json({ error: 'title and type required' }, { status: 400 })
  }
  if (type !== 'notes' && type !== 'todos') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const filename = toFilename(title)
  const initialContent = `# ${title}\n\n`

  try {
    await writeFile(type, filename, initialContent)
    return NextResponse.json({ filename }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/files/route.ts
git commit -m "feat: add file list and create API route"
```

---

### Task 7: File Read, Update, Delete API

**Files:**
- Create: `src/app/api/files/[type]/[filename]/route.ts`

- [ ] **Step 1: Implement route**

```typescript
// src/app/api/files/[type]/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, deleteFile, renameFile } from '@/lib/files'
import { toFilename, extractTitle } from '@/lib/slugify'
import { FileType } from '@/types'

type Params = { type: FileType; filename: string }

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { type, filename } = params
  try {
    const content = await readFile(type, filename)
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const { type, filename } = params
  const body = await req.json()

  // Handle rename
  if (body.newTitle) {
    const newFilename = toFilename(body.newTitle)
    try {
      await renameFile(type, filename, newFilename)
      return NextResponse.json({ filename: newFilename })
    } catch {
      return NextResponse.json({ error: 'Rename failed' }, { status: 500 })
    }
  }

  // Handle content update
  if (body.content !== undefined) {
    try {
      await writeFile(type, filename, body.content)
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Write failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { type, filename } = params
  try {
    await deleteFile(type, filename)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/files/[type]/[filename]/route.ts
git commit -m "feat: add file read/update/delete API route"
```

---

### Task 8: Search API

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Implement route**

```typescript
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { listFiles } from '@/lib/files'
import { FileType, SearchResult } from '@/types'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? ''
  const typeParam = req.nextUrl.searchParams.get('type') as FileType | null

  const types: FileType[] = typeParam ? [typeParam] : ['notes', 'todos']

  try {
    const results: SearchResult[] = []
    for (const type of types) {
      const files = await listFiles(type)
      for (const file of files) {
        if (file.title.toLowerCase().includes(q)) {
          results.push({ filename: file.filename, title: file.title, type })
        }
      }
    }
    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: add file title search API route"
```

---

## Chunk 3: UI Foundation

### Task 9: Root Layout + Dark Mode

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Enable Tailwind dark mode class strategy**

Edit `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
```

- [ ] **Step 2: Update globals.css**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --sidebar-width: 260px;
}

html { height: 100%; }
body { height: 100%; overflow: hidden; }
```

- [ ] **Step 3: Update root layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Private Wiki',
  description: 'Personal markdown memo and todo app',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Update home page (redirect)**

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/notes')
}
```

- [ ] **Step 5: Verify dev server works**

```bash
pnpm dev
```

Expected: `http://localhost:3000` redirects to `/notes` (404 page is OK at this stage)

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/page.tsx tailwind.config.ts
git commit -m "feat: configure root layout with ThemeProvider and dark mode"
```

---

### Task 10: ThemeToggle Component

**Files:**
- Create: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Implement**

```typescript
// src/components/ThemeToggle.tsx
'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-8 h-8" />

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
      title="Toggle dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle component"
```

---

### Task 11: TopNav Component

**Files:**
- Create: `src/components/TopNav.tsx`

- [ ] **Step 1: Implement**

```typescript
// src/components/TopNav.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopNav.tsx
git commit -m "feat: add TopNav with notes/todos tabs and new file button"
```

---

### Task 12: Sidebar Components

**Files:**
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/FileItem.tsx`
- Create: `src/components/TagFilter.tsx`
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Implement SearchBar**

```typescript
// src/components/SearchBar.tsx
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
```

- [ ] **Step 2: Implement FileItem**

```typescript
// src/components/FileItem.tsx
'use client'
import { FileEntry } from '@/types'
import { format } from 'date-fns'

interface FileItemProps {
  file: FileEntry
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newTitle: string) => void
}

export function FileItem({ file, isActive, onSelect, onDelete, onRename }: FileItemProps) {
  const handleRename = () => {
    const newTitle = window.prompt('새 제목:', file.title)
    if (newTitle && newTitle.trim()) onRename(newTitle.trim())
  }

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 cursor-pointer rounded mx-1 ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{file.title}</p>
        <p className="text-xs text-gray-400">
          {format(new Date(file.updatedAt), 'MM/dd')}
          {file.tags.length > 0 && ` · ${file.tags.map((t) => `#${t}`).join(' ')}`}
        </p>
      </div>
      <div className="hidden group-hover:flex items-center gap-1 ml-2 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); handleRename() }}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
          title="이름 변경"
        >✏️</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-xs"
          title="삭제"
        >🗑️</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement TagFilter**

```typescript
// src/components/TagFilter.tsx
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
```

- [ ] **Step 4: Implement Sidebar**

```typescript
// src/components/Sidebar.tsx
'use client'
import { useState, useMemo } from 'react'
import { FileEntry, FileType } from '@/types'
import { SearchBar } from './SearchBar'
import { FileItem } from './FileItem'
import { TagFilter } from './TagFilter'

interface SidebarProps {
  files: FileEntry[]
  activeFilename: string | null
  type: FileType
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
}

export function Sidebar({ files, activeFilename, type, onSelect, onDelete, onRename }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    files.forEach((f) => f.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [files])

  const filtered = useMemo(() => {
    return files.filter((f) => {
      const matchSearch = f.title.toLowerCase().includes(search.toLowerCase())
      const matchTag = !activeTag || f.tags.includes(activeTag)
      return matchSearch && matchTag
    })
  }, [files, search, activeTag])

  return (
    <aside className="w-[260px] flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
      <SearchBar value={search} onChange={setSearch} />
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">
            {search ? '검색 결과 없음' : '파일이 없습니다'}
          </p>
        ) : (
          filtered.map((file) => (
            <FileItem
              key={file.filename}
              file={file}
              isActive={file.filename === activeFilename}
              onSelect={() => onSelect(file.filename)}
              onDelete={() => {
                if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
                  onDelete(file.filename)
                }
              }}
              onRename={(newTitle) => onRename(file.filename, newTitle)}
            />
          ))
        )}
      </div>
      <TagFilter tags={allTags} activeTag={activeTag} onTagClick={setActiveTag} />
    </aside>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/FileItem.tsx src/components/TagFilter.tsx src/components/Sidebar.tsx
git commit -m "feat: add Sidebar, FileItem, SearchBar, TagFilter components"
```

---

## Chunk 4: Editor + Auto-save

### Task 13: useAutoSave Hook

**Files:**
- Create: `src/hooks/useAutoSave.ts`
- Test: `__tests__/hooks/useAutoSave.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/hooks/useAutoSave.test.ts
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '@/hooks/useAutoSave'

jest.useFakeTimers()

describe('useAutoSave', () => {
  it('calls saveFn after 2s debounce', () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current('content'))
    expect(saveFn).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(2000))
    expect(saveFn).toHaveBeenCalledWith('content')
  })

  it('resets debounce on repeated calls', () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current('first'))
    act(() => jest.advanceTimersByTime(1000))
    act(() => result.current('second'))
    act(() => jest.advanceTimersByTime(2000))

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith('second')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm jest __tests__/hooks/useAutoSave.test.ts
```

- [ ] **Step 3: Implement useAutoSave**

```typescript
// src/hooks/useAutoSave.ts
import { useCallback, useRef } from 'react'

export function useAutoSave(
  saveFn: (content: string) => Promise<void>,
  delay: number = 2000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback(
    (content: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        saveFn(content)
      }, delay)
    },
    [saveFn, delay]
  )

  return trigger
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm jest __tests__/hooks/useAutoSave.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAutoSave.ts __tests__/hooks/useAutoSave.test.ts
git commit -m "feat: add useAutoSave hook with 2s debounce"
```

---

### Task 14: TipTap Editor Component

**Files:**
- Create: `src/components/EditorToolbar.tsx`
- Create: `src/components/Editor.tsx`

- [ ] **Step 1: Implement EditorToolbar**

```typescript
// src/components/EditorToolbar.tsx
'use client'
import { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

type ToolbarButton = {
  label: string
  action: () => void
  isActive?: boolean
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  const buttons: ToolbarButton[] = [
    {
      label: 'B',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      label: 'I',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      label: 'H1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'H2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      label: '≡',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      label: '1.',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      label: '☑',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
    },
    {
      label: '```',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
    },
  ]

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onMouseDown={(e) => { e.preventDefault(); btn.action() }}
          className={`px-2 py-1 text-sm rounded transition-colors font-mono ${
            btn.isActive
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement Editor component**

```typescript
// src/components/Editor.tsx
'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useCallback } from 'react'
import { EditorToolbar } from './EditorToolbar'
import { useAutoSave } from '@/hooks/useAutoSave'

interface EditorProps {
  content: string              // markdown string
  filename: string
  type: 'notes' | 'todos'
  onSave?: (filename: string) => void  // called after successful save (to refresh file list)
}

export function Editor({ content, filename, type, onSave }: EditorProps) {
  const saveFn = useCallback(
    async (markdownContent: string) => {
      await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdownContent }),
      })
      onSave?.(filename)
    },
    [filename, type, onSave]
  )

  const triggerSave = useAutoSave(saveFn, 2000)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '내용을 입력하세요...' }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-full p-6',
      },
    },
    onUpdate({ editor }) {
      const markdown = editor.storage.markdown.getMarkdown()
      triggerSave(markdown)
    },
  })

  // Update content when file changes
  useEffect(() => {
    if (!editor) return
    const current = editor.storage.markdown.getMarkdown()
    if (current !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add prose styles to globals.css**

Append to `src/app/globals.css`:
```css
/* Prose / Editor styles */
.prose { color: inherit; }
.prose h1, .prose h2, .prose h3 { color: inherit; font-weight: 600; }
.prose code { background: rgba(0,0,0,0.05); border-radius: 3px; padding: 0.1em 0.3em; font-size: 0.9em; }
.dark .prose code { background: rgba(255,255,255,0.1); }

/* Task list checkboxes */
ul[data-type="taskList"] { list-style: none; padding: 0; }
ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
ul[data-type="taskList"] li > label { margin-top: 0.15rem; cursor: pointer; }
ul[data-type="taskList"] li > div { flex: 1; }

/* Placeholder */
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #aaa;
  pointer-events: none;
  height: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/EditorToolbar.tsx src/components/Editor.tsx src/app/globals.css
git commit -m "feat: add TipTap WYSIWYG editor with toolbar and auto-save"
```

---

## Chunk 5: Pages + AppShell

### Task 15: AppShell + useFiles Hook

**Files:**
- Create: `src/hooks/useFiles.ts`
- Create: `src/components/AppShell.tsx`

- [ ] **Step 1: Implement useFiles hook**

```typescript
// src/hooks/useFiles.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileEntry, FileType } from '@/types'

export function useFiles(type: FileType) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/files?type=${type}`)
      if (res.ok) setFiles(await res.json())
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => { refresh() }, [refresh])

  const createFile = async (title: string) => {
    const res = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type }),
    })
    if (res.ok) {
      const { filename } = await res.json()
      await refresh()
      return filename as string
    }
    return null
  }

  const deleteFile = async (filename: string) => {
    await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, { method: 'DELETE' })
    await refresh()
  }

  const renameFile = async (filename: string, newTitle: string) => {
    const res = await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTitle }),
    })
    if (res.ok) {
      const { filename: newFilename } = await res.json()
      await refresh()
      return newFilename as string
    }
    return null
  }

  return { files, loading, refresh, createFile, deleteFile, renameFile }
}
```

- [ ] **Step 2: Implement AppShell**

```typescript
// src/components/AppShell.tsx
'use client'
import { useState, useEffect } from 'react'
import { FileType } from '@/types'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { Editor } from './Editor'
import { useFiles } from '@/hooks/useFiles'

interface AppShellProps {
  type: FileType
}

export function AppShell({ type }: AppShellProps) {
  const { files, loading, refresh, createFile, deleteFile, renameFile } = useFiles(type)
  const [activeFilename, setActiveFilename] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState<string>('')

  // Load content when a file is selected
  useEffect(() => {
    if (!activeFilename) return
    fetch(`/api/files/${type}/${encodeURIComponent(activeFilename)}`)
      .then((r) => r.json())
      .then((data) => setActiveContent(data.content ?? ''))
  }, [activeFilename, type])

  // Auto-select first file on load
  useEffect(() => {
    if (!loading && files.length > 0 && !activeFilename) {
      setActiveFilename(files[0].filename)
    }
  }, [loading, files, activeFilename])

  const handleNewFile = async () => {
    const title = window.prompt('새 파일 제목:')
    if (!title?.trim()) return
    const filename = await createFile(title.trim())
    if (filename) setActiveFilename(filename)
  }

  const handleDelete = async (filename: string) => {
    await deleteFile(filename)
    if (filename === activeFilename) {
      setActiveFilename(files.find((f) => f.filename !== filename)?.filename ?? null)
      setActiveContent('')
    }
  }

  const handleRename = async (filename: string, newTitle: string) => {
    const newFilename = await renameFile(filename, newTitle)
    if (newFilename && filename === activeFilename) {
      setActiveFilename(newFilename)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <TopNav onNewFile={handleNewFile} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          files={files}
          activeFilename={activeFilename}
          type={type}
          onSelect={(filename) => setActiveFilename(filename)}
          onDelete={handleDelete}
          onRename={handleRename}
        />
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {activeFilename ? (
            <Editor
              key={activeFilename}
              content={activeContent}
              filename={activeFilename}
              type={type}
              onSave={refresh}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-4">{type === 'notes' ? '📝' : '✅'}</p>
                <p className="text-sm">파일을 선택하거나 새 파일을 만드세요</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFiles.ts src/components/AppShell.tsx
git commit -m "feat: add AppShell and useFiles hook"
```

---

### Task 16: Notes and Todos Pages

**Files:**
- Create: `src/app/notes/page.tsx`
- Create: `src/app/todos/page.tsx`

- [ ] **Step 1: Create notes page**

```typescript
// src/app/notes/page.tsx
import { AppShell } from '@/components/AppShell'

export default function NotesPage() {
  return <AppShell type="notes" />
}
```

- [ ] **Step 2: Create todos page**

```typescript
// src/app/todos/page.tsx
import { AppShell } from '@/components/AppShell'

export default function TodosPage() {
  return <AppShell type="todos" />
}
```

- [ ] **Step 3: Run all tests**

```bash
pnpm jest
```

Expected: All tests PASS

- [ ] **Step 4: Verify full app in browser**

```bash
pnpm dev
```

Manual test checklist:
- [ ] `localhost:3000` redirects to `/notes`
- [ ] Notes tab and Todos tab switch correctly
- [ ] "새 파일" button creates a file and selects it
- [ ] Typing in editor triggers auto-save (file updated after 2s)
- [ ] File appears in sidebar with correct title
- [ ] Rename works (hover over file → ✏️)
- [ ] Delete works (hover over file → 🗑️)
- [ ] Dark mode toggle works
- [ ] Tags typed in editor (e.g. `#work`) appear in tag filter after save
- [ ] Tag filter clicks filter file list
- [ ] Title search in sidebar filters files
- [ ] Todo checkboxes work (click to toggle `- [ ]` ↔ `- [x]`)

- [ ] **Step 5: Final commit**

```bash
git add src/app/notes/page.tsx src/app/todos/page.tsx
git commit -m "feat: add notes and todos pages — MVP complete"
```

---

## Summary

| Phase | Tasks | Key Outputs |
|-------|-------|-------------|
| Chunk 1 | 1–5 | Project scaffolding, type defs, utilities, fs library |
| Chunk 2 | 6–8 | API routes for CRUD and search |
| Chunk 3 | 9–12 | Layout, TopNav, Sidebar, theme |
| Chunk 4 | 13–14 | TipTap editor, auto-save hook |
| Chunk 5 | 15–16 | AppShell wiring, final pages |

After Task 16, the app is fully functional and ready to use at `http://localhost:3000`.
