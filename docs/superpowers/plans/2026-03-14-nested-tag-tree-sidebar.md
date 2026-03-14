# Nested Tag Tree Sidebar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat file list in the sidebar with a VS Code-style collapsible tag tree where slash-separated tags (`#work/project/design`) create folder hierarchy.

**Architecture:** Tag extraction is updated to allow slashes; a new pure function `buildTagTree` converts a flat `FileEntry[]` into a `TagTreeRoot` tree; a new `TagTree` React component renders that tree with collapsible folder nodes. `Sidebar` switches between `TagTree` (no search) and the existing flat list (search active).

**Tech Stack:** TypeScript, React (Next.js 16 App Router), Tailwind CSS v4, Jest + jsdom

**Spec:** `docs/superpowers/specs/2026-03-14-nested-tag-tree-sidebar-design.md`

---

## Chunk 1: extractTags + tagTree lib

### Task 1: Update `extractTags` to support slash-separated tags

**Files:**
- Modify: `src/lib/markdown.ts`
- Test: `__tests__/lib/markdown.test.ts`

- [ ] **Step 1: Add failing tests for slash tags**

Append to `__tests__/lib/markdown.test.ts`:

```typescript
  it('extracts slash-separated nested tag as a single tag', () => {
    expect(extractTags('content #work/project/design end')).toEqual(['work/project/design'])
  })

  it('extracts mixed flat and nested tags', () => {
    expect(extractTags('#personal content #work/project')).toEqual(['personal', 'work/project'])
  })

  it('normalizes trailing slash in tag', () => {
    expect(extractTags('#work/ content')).toEqual(['work'])
  })

  it('does not match tag starting with slash', () => {
    expect(extractTags('#/leading content')).toEqual([])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- __tests__/lib/markdown.test.ts
```

Expected: 4 new tests FAIL.

- [ ] **Step 3: Update `extractTags` in `src/lib/markdown.ts`**

Replace the existing function:

```typescript
export function extractTags(content: string): string[] {
  const allMatches = content.matchAll(/#([a-zA-Z가-힣0-9][a-zA-Z가-힣0-9_/\-]*)/g)
  const tags: string[] = []
  for (const match of allMatches) {
    const normalized = match[1].replace(/\/+$/, '') // trim trailing slashes
    if (normalized) tags.push(normalized)
  }
  return [...new Set(tags)]
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
pnpm test -- __tests__/lib/markdown.test.ts
```

Expected: all tests PASS (including previous ones — no regression).

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.ts __tests__/lib/markdown.test.ts
git commit -m "feat: support slash-separated nested tags in extractTags"
```

---

### Task 2: Create `buildTagTree` utility

**Files:**
- Create: `src/lib/tagTree.ts`
- Create: `__tests__/lib/tagTree.test.ts`

- [ ] **Step 1: Write the test file**

Create `__tests__/lib/tagTree.test.ts`:

```typescript
import { buildTagTree } from '@/lib/tagTree'
import { FileEntry } from '@/types'

function makeFile(filename: string, tags: string[]): FileEntry {
  return {
    filename,
    title: filename,
    type: 'notes',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('buildTagTree', () => {
  it('places a file with a flat tag under the correct root node', () => {
    const file = makeFile('a.md', ['work'])
    const tree = buildTagTree([file])
    expect(tree.roots.get('work')?.files).toContain(file)
  })

  it('places a file with a deep tag only at the leaf node', () => {
    const file = makeFile('b.md', ['work/project/design'])
    const tree = buildTagTree([file])
    const workNode = tree.roots.get('work')!
    const projectNode = workNode.children.get('project')!
    const designNode = projectNode.children.get('design')!
    expect(designNode.files).toContain(file)
    expect(workNode.files).not.toContain(file)
    expect(projectNode.files).not.toContain(file)
  })

  it('places a file with multiple tags in all corresponding leaf nodes', () => {
    const file = makeFile('c.md', ['work', 'personal'])
    const tree = buildTagTree([file])
    expect(tree.roots.get('work')?.files).toContain(file)
    expect(tree.roots.get('personal')?.files).toContain(file)
  })

  it('places a file with no tags in untagged', () => {
    const file = makeFile('d.md', [])
    const tree = buildTagTree([file])
    expect(tree.untagged).toContain(file)
    expect(tree.roots.size).toBe(0)
  })

  it('normalizes trailing slash tag to correct node', () => {
    // extractTags already normalizes — this tests buildTagTree handles it
    const file = makeFile('e.md', ['work'])  // already normalized by extractTags
    const tree = buildTagTree([file])
    expect(tree.roots.get('work')?.files).toContain(file)
  })

  it('handles double-slash tag by filtering empty segments', () => {
    // simulate a tag that somehow has a double slash (edge case)
    const file = makeFile('f.md', ['work//project'])
    const tree = buildTagTree([file])
    const workNode = tree.roots.get('work')!
    const projectNode = workNode.children.get('project')!
    expect(projectNode.files).toContain(file)
  })

  it('sets correct fullPath on each node', () => {
    const file = makeFile('g.md', ['work/project'])
    const tree = buildTagTree([file])
    const workNode = tree.roots.get('work')!
    const projectNode = workNode.children.get('project')!
    expect(workNode.fullPath).toBe('work')
    expect(projectNode.fullPath).toBe('work/project')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- __tests__/lib/tagTree.test.ts
```

Expected: all 7 tests FAIL with "Cannot find module '@/lib/tagTree'".

- [ ] **Step 3: Create `src/lib/tagTree.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- __tests__/lib/tagTree.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tagTree.ts __tests__/lib/tagTree.test.ts
git commit -m "feat: add buildTagTree utility for nested tag hierarchy"
```

---

## Chunk 2: UI components

### Task 3: Add `hideTags` prop to `FileItem`

**Files:**
- Modify: `src/components/FileItem.tsx`

- [ ] **Step 1: Update `FileItem` to accept `hideTags` prop**

In `src/components/FileItem.tsx`, update the props interface and the subtitle line:

```typescript
interface FileItemProps {
  file: FileEntry
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newTitle: string) => void
  hideTags?: boolean
}

export function FileItem({ file, isActive, onSelect, onDelete, onRename, hideTags }: FileItemProps) {
```

Then change the subtitle `<p>` line (currently line 32):

```typescript
        <p className="text-xs text-gray-400">
          {format(new Date(file.updatedAt), 'MM/dd')}
          {!hideTags && file.tags.length > 0 && ` · ${file.tags.map((t) => `#${t}`).join(' ')}`}
        </p>
```

- [ ] **Step 2: Verify no test regressions**

```bash
pnpm test
```

Expected: all existing tests PASS (no tests cover FileItem directly, so no breakage).

- [ ] **Step 3: Commit**

```bash
git add src/components/FileItem.tsx
git commit -m "feat: add hideTags prop to FileItem"
```

---

### Task 4: Create `TagTree` component

**Files:**
- Create: `src/components/TagTree.tsx`

- [ ] **Step 1: Create `src/components/TagTree.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { FileEntry } from '@/types'
import { TagNode, TagTreeRoot } from '@/lib/tagTree'
import { FileItem } from './FileItem'

interface TagTreeProps {
  root: TagTreeRoot
  activeFilename: string | null
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
}

interface TagNodeRowProps {
  node: TagNode
  depth: number
  activeFilename: string | null
  collapsed: Set<string>
  onToggle: (fullPath: string) => void
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
}

function TagNodeRow({
  node,
  depth,
  activeFilename,
  collapsed,
  onToggle,
  onSelect,
  onDelete,
  onRename,
}: TagNodeRowProps) {
  const isCollapsed = collapsed.has(node.fullPath)
  const sortedChildren = [...node.children.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const sortedFiles = [...node.files].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div>
      {/* Folder header row */}
      <button
        onClick={() => onToggle(node.fullPath)}
        className="w-full flex items-center gap-1 pr-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded mx-1"
        style={{ paddingLeft: depth * 16 + 8 + 'px' }}
      >
        <span className="shrink-0">{isCollapsed ? '▶' : '▼'}</span>
        <span className="truncate">{node.name}</span>
      </button>

      {/* Children (folders first, then files) */}
      {!isCollapsed && (
        <>
          {sortedChildren.map((child) => (
            <TagNodeRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              activeFilename={activeFilename}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
          {sortedFiles.map((file) => (
            <div key={file.filename} style={{ paddingLeft: (depth + 1) * 16 + 'px' }}>
              <FileItem
                file={file}
                isActive={file.filename === activeFilename}
                onSelect={() => onSelect(file.filename)}
                onDelete={() => {
                  if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
                    onDelete(file.filename)
                  }
                }}
                onRename={(newTitle) => onRename(file.filename, newTitle)}
                hideTags
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export function TagTree({ root, activeFilename, onSelect, onDelete, onRename }: TagTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapsed = (fullPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(fullPath)) {
        next.delete(fullPath)
      } else {
        next.add(fullPath)
      }
      return next
    })
  }

  const sortedRoots = [...root.roots.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  return (
    <div className="py-1">
      {/* Untagged files at the top */}
      {root.untagged.length > 0 && (
        <div>
          <p
            className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase"
          >
            태그 없음
          </p>
          {root.untagged.map((file) => (
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
          ))}
        </div>
      )}

      {/* Tag tree */}
      {sortedRoots.map((node) => (
        <TagNodeRow
          key={node.fullPath}
          node={node}
          depth={0}
          activeFilename={activeFilename}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify no test regressions**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TagTree.tsx
git commit -m "feat: add TagTree component for nested tag hierarchy"
```

---

### Task 5: Update `Sidebar` to use `TagTree`

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Rewrite `Sidebar.tsx`**

Replace the entire file contents:

```typescript
'use client'
import { useState, useMemo } from 'react'
import { FileEntry, FileType } from '@/types'
import { SearchBar } from './SearchBar'
import { FileItem } from './FileItem'
import { TagTree } from './TagTree'
import { buildTagTree } from '@/lib/tagTree'

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

  const filtered = useMemo(() => {
    if (!search) return []
    return files.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
  }, [files, search])

  const tagTree = useMemo(() => buildTagTree(files), [files])

  return (
    <aside className="w-[260px] flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
      <SearchBar value={search} onChange={setSearch} />
      <div className="flex-1 overflow-y-auto py-1">
        {search ? (
          filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">검색 결과 없음</p>
          ) : (
            <div className="py-1">
              {filtered.map((file) => (
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
              ))}
            </div>
          )
        ) : files.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">파일이 없습니다</p>
        ) : (
          <TagTree
            root={tagTree}
            activeFilename={activeFilename}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
          />
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 3: Verify the app builds without errors**

```bash
pnpm build
```

Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: replace flat file list with nested tag tree in Sidebar"
```

---
