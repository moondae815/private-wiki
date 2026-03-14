# Nested Tag Tree Sidebar — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Replace the flat file list in the sidebar with a VS Code-style collapsible tag tree. Tags using slash notation (`#work/project/design`) define folder hierarchy. Files appear inside their tag nodes; files with multiple tags appear in multiple locations.

---

## Requirements

- Slash-separated tags (`#work/project/design`) create nested folder nodes in the sidebar.
- A file with tag `#work/project/design` appears **only** under the `design` node (leaf). Intermediate ancestor nodes (`work`, `work/project`) do not receive the file unless a separate shallower tag explicitly targets them.
- A file with tag `#work` appears directly under the `work` node (it is the leaf for that tag).
- Files with multiple tags appear in all matching tag locations (duplication allowed).
- Files with no tags appear in a "태그 없음" section at the top of the tree.
- Folder nodes are collapsible (expanded by default). Collapsed state is managed as a `Set<string>` of collapsed `fullPath` values in the top-level `TagTree` component and passed down as props — this avoids state reset on re-render.
- Within a node, child tag-folders are rendered **before** files, both groups sorted alphabetically.
- Files and subfolders coexist at the same level within a folder node.
- When a search query is active, fall back to a flat list filtered by title only (no tag filter). `activeTag` state is removed entirely.
- The bottom `TagFilter` pill strip is removed (the tree replaces it).
- `buildTagTree` receives the already type-filtered `FileEntry[]` from `Sidebar` (i.e., notes and todos are never mixed).

---

## Data Model

```typescript
interface TagNode {
  name: string              // segment label, e.g. "project"
  fullPath: string          // full tag path, e.g. "work/project"
  children: Map<string, TagNode>
  files: FileEntry[]        // files whose tag exactly equals fullPath
}

interface TagTreeRoot {
  roots: Map<string, TagNode>   // top-level tag nodes keyed by segment name
  untagged: FileEntry[]         // files with no tags at all
}
```

---

## Changes

### 1. `src/lib/markdown.ts` — update `extractTags`

Change regex to allow `/` inside tag names:

```
/#([a-zA-Z가-힣0-9][a-zA-Z가-힣0-9_/\-]*)/g
```

- Requires first character to be alphanumeric (prevents `#/leading-slash` matches).
- After collecting each match, normalize: trim trailing `/`, skip if empty after trim.
- Normalization happens **inside `extractTags`** before pushing to the result array.

### 2. `src/lib/tagTree.ts` — new file

```typescript
export function buildTagTree(files: FileEntry[]): TagTreeRoot
```

Algorithm:
1. Initialize `roots = new Map<string, TagNode>()` and `untagged: FileEntry[] = []`.
2. For each file:
   - If `file.tags.length === 0`, push to `untagged` and continue.
   - For each tag:
     - Split by `/` → segments, then **filter out empty strings** (`segments.filter(Boolean)`). Skip this tag if the resulting list is empty. This handles double slashes (`#work//project`) and any other edge case.
     - Walk `roots` (and recursively `node.children`) creating nodes as needed: `{ name: segment, fullPath: accumulated path, children: new Map(), files: [] }`.
     - **Append the file only to the leaf node** (last segment's node). No ancestor receives the file.
3. Return `{ roots, untagged }`.

### 3. `src/components/TagTree.tsx` — new component

Props:
```typescript
interface TagTreeProps {
  root: TagTreeRoot
  activeFilename: string | null
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
  onRename: (filename: string, newTitle: string) => void
  // `type` prop is intentionally excluded — TagTree is always rendered with a
  // pre-filtered (by type) FileEntry list so the tree never mixes notes and todos.
}
```

State: `const [collapsed, setCollapsed] = useState<Set<string>>(new Set())` — keyed by `fullPath`.

Rendering:
- Untagged section first (if any): header "태그 없음", then `FileItem` rows.
- For each root node (sorted alphabetically): render `TagNodeRow` recursively.
- `TagNodeRow` renders: chevron + name header, then (if not collapsed) children folders (sorted alphabetically), then files. **Sorting of files happens at render time in `TagNodeRow`** (sorted by `updatedAt` desc); `buildTagTree` makes no ordering guarantees for `files` arrays.
- Indentation: use inline `style={{ paddingLeft: depth * 16 + 'px' }}` — avoids Tailwind dynamic class issues.
- `FileItem` receives a `hideTags` prop (new) to suppress the tag line when rendered inside the tree.

### 4. `src/components/FileItem.tsx` — minor update

Add optional `hideTags?: boolean` prop. When true, suppress only the ` · #tag` suffix within the subtitle `<p>` element — the date portion remains visible.

### 5. `src/components/Sidebar.tsx` — update

- Remove `allTags`, `activeTag`, `setActiveTag` state.
- When `search === ''`: render `<TagTree root={buildTagTree(files)} ... />`.
- When `search !== ''`: render existing flat list filtered by title only.
- Remove `<TagFilter>` from JSX.

---

## Testing

Add `__tests__/lib/tagTree.test.ts` covering:
- File with a single flat tag (`#work`) → appears in `roots.get('work').files`.
- File with a deep tag (`#work/project/design`) → appears only in `design.files`, not in `work.files` or `project.files`.
- File with multiple tags → appears in all corresponding leaf nodes.
- File with no tags → appears in `untagged`.
- Tag with trailing slash (`#work/`) → normalized to `work`, placed in `roots.get('work')`.
- Tag with double slash (`#work//project`) → empty segment filtered out, treated as `#work/project`.

---

## Out of Scope

- Drag-and-drop reordering of nodes.
- Renaming tags from the tree UI.
- Persistent collapsed/expanded state across page reloads.
