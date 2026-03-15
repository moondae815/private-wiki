# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server
pnpm build      # Production build
pnpm lint       # ESLint
pnpm test       # Jest (jsdom environment)
```

Run a single test file:
```bash
pnpm test -- __tests__/your-test.spec.ts
```

## Architecture

**Next.js 16 App Router** personal markdown wiki with two content types: `notes` and `todos`.

### Data Flow

Files are stored as `.md` files in `data/notes/` and `data/todos/`. All persistence goes through REST API routes (`src/app/api/`) which use Node.js file I/O (`src/lib/files.ts`). There is no database.

- `GET /api/files?type=notes|todos` — list files
- `POST /api/files` — create file
- `GET|PUT|DELETE /api/files/[type]/[filename]` — read, update, delete
- `GET /api/search?q=...&type=notes|todos` — full-text search across files

### Component Hierarchy

`/notes` or `/todos` page → `AppShell` (layout) → `Sidebar` + `Editor`

- `AppShell` owns the active file selection state
- `useFiles()` hook (`src/hooks/useFiles.ts`) manages the file list and CRUD mutations
- `useAutoSave()` hook (`src/hooks/useAutoSave.ts`) debounces editor saves (2s)

### Editor

Tiptap 3 with the `tiptap-markdown` extension — content is always stored as markdown but rendered as rich text. Task lists (checkboxes) are supported for todos.

### File Naming & Metadata

Filenames follow `YYYY-MM-DD-{slugified-title}.md`. Tags are extracted from inline `#tag-name` patterns in content (not from headings); slash-separated tags (`#parent/child`) form a hierarchy in the Sidebar. See `src/lib/markdown.ts` and `src/lib/tagTree.ts`.

Todo items in `.md` files use GFM checkbox syntax (`- [ ]`/`- [x]`) with optional inline metadata: `@due:YYYY-MM-DD` and `@priority:high|medium|low`. Parsed/serialized by `src/lib/todos.ts`.

### Todos vs Notes

The `/todos` page uses `TodoView` (structured checkbox list) instead of the Tiptap `Editor`. `TodoView` renders `TodoItem` components with inline due-date and priority pickers, and auto-saves with a 500ms debounce.

### Private (Encrypted) Notes

Files whose content starts with `PRIVATE:` are encrypted. `src/lib/crypto.ts` provides client-side AES-GCM encryption via the Web Crypto API (PBKDF2 key derivation, 100k iterations). `src/lib/fileFormat.ts` exposes `isPrivate()` to detect encrypted blobs. `PasswordModal` handles unlock UI. **Never import `crypto.ts` from API routes or server-side lib** — it uses browser globals only.

### Dialog Component

`src/components/Dialog.tsx` replaces native `window.prompt`/`window.confirm` throughout the app. Use it instead of browser dialogs for any user prompts.

### Styling

Tailwind CSS v4 with `@tailwindcss/typography` for prose styling in the editor. Dark mode via `next-themes`. Path alias `@/*` maps to `src/*`.
