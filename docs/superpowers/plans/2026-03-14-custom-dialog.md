# Custom Dialog Modals Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `window.prompt` / `window.confirm` calls with a custom `Dialog` modal component matching the existing `PasswordModal` style.

**Architecture:** A single `Dialog` component handles two modes (`prompt` for text input, `confirm` for confirmation). Each component that currently calls `window.prompt`/`window.confirm` adds local `useState<DialogConfig | null>` and renders `{dialog && <Dialog {...dialog} />}` — no prop drilling or global state needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Jest + @testing-library/react

---

## Chunk 1: Dialog component

### Task 1: Create Dialog component and tests

**Files:**
- Create: `src/components/Dialog.tsx`
- Create: `__tests__/components/Dialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/Dialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog } from '@/components/Dialog'

describe('Dialog – prompt mode', () => {
  it('renders title and input', () => {
    render(<Dialog type="prompt" title="새 파일 제목:" placeholder="제목" onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('새 파일 제목:')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('제목')).toBeInTheDocument()
  })

  it('calls onSubmit with trimmed value', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  hello  ' } })
    fireEvent.click(screen.getByText('확인'))
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('does not submit empty value', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByText('확인'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits on Enter key', () => {
    const onSubmit = jest.fn()
    render(<Dialog type="prompt" title="제목:" onSubmit={onSubmit} onCancel={jest.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('test')
  })

  it('pre-fills defaultValue', () => {
    render(<Dialog type="prompt" title="제목:" defaultValue="기존 제목" onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('기존 제목')
  })
})

describe('Dialog – confirm mode', () => {
  it('renders title and message', () => {
    render(<Dialog type="confirm" title="파일 삭제" message='"foo"을 삭제할까요?' onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('파일 삭제')).toBeInTheDocument()
    expect(screen.getByText('"foo"을 삭제할까요?')).toBeInTheDocument()
  })

  it('calls onConfirm on 확인 click', () => {
    const onConfirm = jest.fn()
    render(<Dialog type="confirm" title="삭제" message="삭제할까요?" onConfirm={onConfirm} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByText('확인'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('danger=true applies red button class', () => {
    render(<Dialog type="confirm" title="삭제" message="?" danger onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('확인')).toHaveClass('bg-red-600')
  })
})

describe('Dialog – shared', () => {
  it('calls onCancel on 취소 click', () => {
    const onCancel = jest.fn()
    render(<Dialog type="confirm" title="삭제" message="?" onConfirm={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('취소'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel on Escape key', () => {
    const onCancel = jest.fn()
    render(<Dialog type="confirm" title="삭제" message="?" onConfirm={jest.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- __tests__/components/Dialog.test.tsx
```

Expected: FAIL (Dialog module not found)

- [ ] **Step 3: Implement Dialog component**

Create `src/components/Dialog.tsx`:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'

export type DialogConfig =
  | {
      type: 'prompt'
      title: string
      placeholder?: string
      defaultValue?: string
      onSubmit: (value: string) => void
      onCancel: () => void
    }
  | {
      type: 'confirm'
      title: string
      message: string
      danger?: boolean
      onConfirm: () => void
      onCancel: () => void
    }

export function Dialog(props: DialogConfig) {
  const [value, setValue] = useState(
    props.type === 'prompt' ? (props.defaultValue ?? '') : ''
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [props.onCancel])

  const handleSubmit = () => {
    if (props.type === 'prompt') {
      if (!value.trim()) return
      props.onSubmit(value.trim())
    } else {
      props.onConfirm()
    }
  }

  const isPrompt = props.type === 'prompt'
  const isDanger = props.type === 'confirm' && props.danger

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
        <h2 className="text-sm font-semibold mb-4">{props.title}</h2>

        {props.type === 'confirm' && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{props.message}</p>
        )}

        {isPrompt && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={props.placeholder}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-transparent mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPrompt && !value.trim()}
            className={`text-sm px-3 py-1.5 rounded text-white disabled:opacity-40 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- __tests__/components/Dialog.test.tsx
```

Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Dialog.tsx __tests__/components/Dialog.test.tsx
git commit -m "feat: add Dialog component for prompt and confirm modals"
```

---

## Chunk 2: Replace window.confirm calls

### Task 2: Sidebar.tsx — replace window.confirm

**Files:**
- Modify: `src/components/Sidebar.tsx`

The filtered search results section has one inline `window.confirm` in the `onDelete` handler (line ~46).

- [ ] **Step 1: Add dialog state and Dialog import**

In `Sidebar.tsx`:
1. Add import: `import { Dialog, DialogConfig } from './Dialog'`
2. Inside the `Sidebar` function body (after the existing `useState` calls), add:
   ```tsx
   const [dialog, setDialog] = useState<DialogConfig | null>(null)
   ```

- [ ] **Step 2: Replace window.confirm in the search results section**

Find this block (around line 45-49):
```tsx
onDelete={() => {
  if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
    onDelete(file.filename)
  }
}}
```

Replace with:
```tsx
onDelete={() => {
  setDialog({
    type: 'confirm',
    title: '파일 삭제',
    message: `"${file.title}"을 삭제할까요?`,
    danger: true,
    onConfirm: () => { setDialog(null); onDelete(file.filename) },
    onCancel: () => setDialog(null),
  })
}}
```

- [ ] **Step 3: Add Dialog render at end of returned JSX**

Inside the `<aside>` element, just before its closing `</aside>` tag, add:
```tsx
{dialog && <Dialog {...dialog} />}
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All tests PASS (no regressions)

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: replace window.confirm with Dialog in Sidebar"
```

### Task 3: TagTree.tsx — replace window.confirm (2 places)

**Files:**
- Modify: `src/components/TagTree.tsx`

There are two `window.confirm` calls:
1. In `TagNodeRow` function component (around line 86) — tagged files
2. In `TagTree` exported component (around line 139) — untagged files

- [ ] **Step 1: Add Dialog import and state to TagNodeRow**

In `TagTree.tsx`:
1. Add import at top: `import { Dialog, DialogConfig } from './Dialog'`
2. Inside `TagNodeRow` function body (after `const sortedFiles = ...`), add:
   ```tsx
   const [dialog, setDialog] = useState<DialogConfig | null>(null)
   ```

- [ ] **Step 2: Replace window.confirm in TagNodeRow**

Find (around line 85-89):
```tsx
onDelete={() => {
  if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
    onDelete(file.filename)
  }
}}
```

Replace with:
```tsx
onDelete={() => {
  setDialog({
    type: 'confirm',
    title: '파일 삭제',
    message: `"${file.title}"을 삭제할까요?`,
    danger: true,
    onConfirm: () => { setDialog(null); onDelete(file.filename) },
    onCancel: () => setDialog(null),
  })
}}
```

- [ ] **Step 3: Add Dialog render inside TagNodeRow's returned JSX**

Inside the outermost `<div>` of `TagNodeRow`'s return, just before its closing `</div>`, add:
```tsx
{dialog && <Dialog {...dialog} />}
```

- [ ] **Step 4: Add dialog state to TagTree component**

Inside the exported `TagTree` function body (after `const toggleCollapsed = ...`), add:
```tsx
const [dialog, setDialog] = useState<DialogConfig | null>(null)
```

- [ ] **Step 5: Replace window.confirm in TagTree's untagged section**

Find (around line 138-142):
```tsx
onDelete={() => {
  if (window.confirm(`"${file.title}"을 삭제할까요?`)) {
    onDelete(file.filename)
  }
}}
```

Replace with:
```tsx
onDelete={() => {
  setDialog({
    type: 'confirm',
    title: '파일 삭제',
    message: `"${file.title}"을 삭제할까요?`,
    danger: true,
    onConfirm: () => { setDialog(null); onDelete(file.filename) },
    onCancel: () => setDialog(null),
  })
}}
```

- [ ] **Step 6: Add Dialog render inside TagTree's returned JSX**

Inside the outermost `<div className="py-1">` of `TagTree`'s return, just before its closing `</div>`, add:
```tsx
{dialog && <Dialog {...dialog} />}
```

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/TagTree.tsx
git commit -m "feat: replace window.confirm with Dialog in TagTree"
```

---

## Chunk 3: Replace window.prompt calls

### Task 4: FileItem.tsx — replace window.prompt (rename)

**Files:**
- Modify: `src/components/FileItem.tsx`

The `handleRename` function (around line 26-29) calls `window.prompt`.

- [ ] **Step 1: Add Dialog import and state**

In `FileItem.tsx`:
1. Add import: `import { Dialog, DialogConfig } from './Dialog'`
2. Add `useState` to the React import: `import { useState } from 'react'`
3. Inside `FileItem` function body, before `handleRename`, add:
   ```tsx
   const [dialog, setDialog] = useState<DialogConfig | null>(null)
   ```

- [ ] **Step 2: Replace handleRename**

Find:
```tsx
const handleRename = () => {
  const newTitle = window.prompt('새 제목:', file.title)
  if (newTitle && newTitle.trim()) onRename(newTitle.trim())
}
```

Replace with:
```tsx
const handleRename = () => {
  setDialog({
    type: 'prompt',
    title: '이름 변경',
    placeholder: '새 제목',
    defaultValue: file.title,
    onSubmit: (newTitle) => { setDialog(null); onRename(newTitle) },
    onCancel: () => setDialog(null),
  })
}
```

- [ ] **Step 3: Add Dialog render at end of returned JSX**

Inside the outermost `<div>` of `FileItem`'s return, just before its closing `</div>`, add:
```tsx
{dialog && <Dialog {...dialog} />}
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FileItem.tsx
git commit -m "feat: replace window.prompt with Dialog in FileItem rename"
```

### Task 5: AppShell.tsx — replace window.prompt (new file)

**Files:**
- Modify: `src/components/AppShell.tsx`

The `handleNewFile` function (around line 139-143) calls `window.prompt`.

- [ ] **Step 1: Add Dialog import**

In `AppShell.tsx`, add to imports:
```tsx
import { Dialog, DialogConfig } from './Dialog'
```

- [ ] **Step 2: Add dialog state**

Near the other `useState` declarations in `AppShell`, add:
```tsx
const [dialog, setDialog] = useState<DialogConfig | null>(null)
```

- [ ] **Step 3: Replace handleNewFile**

Find:
```tsx
const handleNewFile = async () => {
  const title = window.prompt('새 파일 제목:')
  if (!title?.trim()) return
  const filename = await createFile(title.trim())
  if (filename) setActiveFilename(filename)
}
```

Replace with:
```tsx
const handleNewFile = () => {
  setDialog({
    type: 'prompt',
    title: '새 파일 제목',
    placeholder: '제목을 입력하세요',
    onSubmit: async (title) => {
      setDialog(null)
      const filename = await createFile(title)
      if (filename) setActiveFilename(filename)
    },
    onCancel: () => setDialog(null),
  })
}
```

- [ ] **Step 4: Add Dialog render inside AppShell's returned JSX**

In `AppShell`'s return, alongside the existing `{modal && <PasswordModal ... />}`, add:
```tsx
{dialog && <Dialog {...dialog} />}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Step 6: Final full lint check**

```bash
pnpm lint
```

Expected: No new errors introduced

- [ ] **Step 7: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat: replace window.prompt with Dialog in AppShell new file"
```
