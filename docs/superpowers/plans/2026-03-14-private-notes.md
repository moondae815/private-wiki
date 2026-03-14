# Private Notes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file-level password-based encryption to notes using AES-GCM + PBKDF2 via the Web Crypto API.

**Architecture:** A shared `fileFormat.ts` utility detects private files server- and client-side; a client-only `crypto.ts` module handles encrypt/decrypt using the browser's native Web Crypto API. The server stores and returns the encrypted blob unchanged — the password never leaves the client. `AppShell` gates content access behind a `PasswordModal` and passes the password down to `Editor`, which wraps its `saveFn` with `encrypt` before calling `PUT`.

**Tech Stack:** Web Crypto API (`window.crypto.subtle`), PBKDF2, AES-GCM, React state, Jest/jsdom for unit tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/fileFormat.ts` | `isPrivate()` — shared server+client utility |
| Create | `src/lib/crypto.ts` | `CryptoError`, `encrypt()`, `decrypt()` — client-only |
| Modify | `src/types/index.ts` | Add `isPrivate: boolean` to `FileEntry` |
| Modify | `src/lib/files.ts` | Use `isPrivate()` in `listFiles` to populate the new field |
| Modify | `src/hooks/useAutoSave.ts` | Return `{ trigger, flush }` instead of just `trigger` |
| Create | `src/components/PasswordModal.tsx` | Password input modal (unlock / set / unset modes) |
| Modify | `src/components/FileItem.tsx` | Blur private titles, lock icon, context menu additions |
| Modify | `src/components/AppShell.tsx` | `activePassword` state, deferred fetch, modal gate |
| Modify | `src/components/Editor.tsx` | `password` prop, encrypt-before-save in `saveFn` |
| Create | `__tests__/lib/fileFormat.test.ts` | Unit tests for `isPrivate` |
| Create | `__tests__/lib/crypto.test.ts` | Unit tests for `encrypt`/`decrypt`/`CryptoError` |
| Modify | `__tests__/hooks/useAutoSave.test.ts` | Tests for `flush()` |

---

## Chunk 1: Foundation — fileFormat, crypto, types

### Task 1: `isPrivate` shared utility

**Files:**
- Create: `src/lib/fileFormat.ts`
- Create: `__tests__/lib/fileFormat.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/fileFormat.test.ts
import { isPrivate } from '@/lib/fileFormat'

describe('isPrivate', () => {
  it('returns true for PRIVATE: prefix', () => {
    expect(isPrivate('PRIVATE:abc:def:ghi')).toBe(true)
  })

  it('returns false for plain markdown', () => {
    expect(isPrivate('# Hello\n\nworld')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isPrivate('')).toBe(false)
  })

  it('returns false if PRIVATE: is not at the very start', () => {
    expect(isPrivate('\nPRIVATE:abc')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/fileFormat.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/fileFormat'"

- [ ] **Step 3: Implement `fileFormat.ts`**

```ts
// src/lib/fileFormat.ts
export function isPrivate(content: string): boolean {
  return content.startsWith('PRIVATE:')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/fileFormat.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fileFormat.ts __tests__/lib/fileFormat.test.ts
git commit -m "feat: add isPrivate shared utility"
```

---

### Task 2: `CryptoError` + `encrypt` / `decrypt`

**Files:**
- Modify: `jest.setup.ts` — add `webcrypto` polyfill
- Create: `src/lib/crypto.ts`
- Create: `__tests__/lib/crypto.test.ts`

> **Why the polyfill:** jsdom v26 does not implement `crypto.subtle`. The tests use Node.js's built-in `webcrypto` (available since Node 15, complete in Node 18+) to polyfill it so the tests exercise real AES-GCM/PBKDF2 code paths.

- [ ] **Step 1: Add `webcrypto` polyfill to `jest.setup.ts`**

Add the following **before** the existing `import '@testing-library/jest-dom'` line:

```ts
import { webcrypto } from 'node:crypto'
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: false,
  configurable: true,  // required: jsdom may have already defined crypto
})
```

- [ ] **Step 2: Verify existing tests still pass after polyfill**

```bash
pnpm test
```

Expected: all existing tests PASS

- [ ] **Step 3: Write the failing crypto tests**

```ts
// __tests__/lib/crypto.test.ts
import { encrypt, decrypt, CryptoError } from '@/lib/crypto'

describe('encrypt / decrypt round-trip', () => {
  it('decrypts to the original plaintext', async () => {
    const plaintext = '# 비밀 노트\n\n내용입니다.'
    const password = 'hunter2'
    const blob = await encrypt(plaintext, password)
    const result = await decrypt(blob, password)
    expect(result).toBe(plaintext)
  })

  it('produces a PRIVATE: blob', async () => {
    const blob = await encrypt('hello', 'pw')
    expect(blob.startsWith('PRIVATE:')).toBe(true)
  })

  it('produces different blobs for the same input (random salt+IV)', async () => {
    const blob1 = await encrypt('hello', 'pw')
    const blob2 = await encrypt('hello', 'pw')
    expect(blob1).not.toBe(blob2)
  })
})

describe('decrypt errors', () => {
  it('throws CryptoError with wrong_password on wrong password', async () => {
    const blob = await encrypt('secret', 'correct')
    await expect(decrypt(blob, 'wrong')).rejects.toMatchObject({
      code: 'wrong_password',
    })
  })

  it('throws CryptoError with corrupt_format on malformed blob', async () => {
    await expect(decrypt('PRIVATE:onlyone', 'pw')).rejects.toMatchObject({
      code: 'corrupt_format',
    })
  })

  it('throws CryptoError with corrupt_format on invalid base64', async () => {
    await expect(decrypt('PRIVATE:!!!:!!!:!!!', 'pw')).rejects.toMatchObject({
      code: 'corrupt_format',
    })
  })
})

describe('CryptoError', () => {
  it('is an instance of Error', () => {
    const err = new CryptoError('wrong_password', 'bad')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('wrong_password')
    expect(err.message).toBe('bad')
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pnpm test -- __tests__/lib/crypto.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/crypto'"

- [ ] **Step 5: Implement `crypto.ts`**

```ts
// src/lib/crypto.ts
// CLIENT-ONLY: never import this from src/app/api/ or src/lib/files.ts

export class CryptoError extends Error {
  constructor(
    public code: 'wrong_password' | 'corrupt_format',
    message: string
  ) {
    super(message)
    this.name = 'CryptoError'
  }
}

const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH = 256

function b64ToBytes(b64: string): Uint8Array {
  try {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  } catch {
    throw new CryptoError('corrupt_format', 'Invalid base64')
  }
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(
  plaintext: string,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return `PRIVATE:${bytesToB64(salt)}:${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ciphertext))}`
}

export async function decrypt(
  encrypted: string,
  password: string
): Promise<string> {
  const parts = encrypted.split(':')
  // Format: PRIVATE:<salt>:<iv>:<ciphertext> — 4 parts
  if (parts.length !== 4 || parts[0] !== 'PRIVATE') {
    throw new CryptoError('corrupt_format', 'Invalid PRIVATE blob format')
  }
  const [, saltB64, ivB64, ciphertextB64] = parts
  const salt = b64ToBytes(saltB64)
  const iv = b64ToBytes(ivB64)
  const ciphertext = b64ToBytes(ciphertextB64)

  const key = await deriveKey(password, salt)
  let plainBytes: ArrayBuffer
  try {
    plainBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
  } catch {
    throw new CryptoError('wrong_password', 'Decryption failed')
  }
  return new TextDecoder().decode(plainBytes)
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test -- __tests__/lib/crypto.test.ts
```

Expected: 7 tests PASS

- [ ] **Step 7: Commit**

```bash
git add jest.setup.ts src/lib/crypto.ts __tests__/lib/crypto.test.ts
git commit -m "feat: add AES-GCM encrypt/decrypt with PBKDF2 key derivation"
```

---

### Task 3: Add `isPrivate` to `FileEntry` type and `listFiles`

**Files:**
- Modify: `__tests__/lib/files.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/files.ts`

- [ ] **Step 1: Add a failing test for the new `isPrivate` behavior**

Update the existing test in `__tests__/lib/files.test.ts` to also assert `isPrivate: false`, and add a new test for private files. Replace the existing `it('returns FileEntry array...')` body and append one new test:

```ts
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
```

- [ ] **Step 2: Run the files test to verify the new assertions fail**

```bash
pnpm test -- __tests__/lib/files.test.ts
```

Expected: FAIL — `result[0].isPrivate` is `undefined` (field does not exist yet)

- [ ] **Step 3: Update `FileEntry` in `src/types/index.ts`**

Add `isPrivate: boolean` after `updatedAt`:

```ts
export interface FileEntry {
  filename: string
  title: string
  type: FileType
  tags: string[]
  createdAt: string
  updatedAt: string
  isPrivate: boolean  // NEW
}
```

- [ ] **Step 4: Update `listFiles` in `src/lib/files.ts`**

Add the import at the top of the file:

```ts
import { isPrivate } from '@/lib/fileFormat'
```

Then in the `entries` mapping, replace the returned object:

```ts
return {
  filename,
  title: extractTitle(filename),
  type,
  tags: isPrivate(content) ? [] : extractTags(content),
  createdAt: stat.birthtime.toISOString(),
  updatedAt: stat.mtime.toISOString(),
  isPrivate: isPrivate(content),
} as FileEntry
```

- [ ] **Step 5: Run all tests to verify everything passes**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/files.ts __tests__/lib/files.test.ts
git commit -m "feat: add isPrivate field to FileEntry and listFiles"
```

---

## Chunk 2: `useAutoSave` flush

### Task 4: Add `flush()` to `useAutoSave`

**Files:**
- Modify: `src/hooks/useAutoSave.ts`
- Modify: `__tests__/hooks/useAutoSave.test.ts`

- [ ] **Step 1: Update the two existing tests to use the new return shape**

The current hook returns `trigger` directly; after this change it returns `{ trigger, flush }`. Update `__tests__/hooks/useAutoSave.test.ts` — change both existing test bodies:

- `result.current('content')` → `result.current.trigger('content')`
- `result.current('first')` → `result.current.trigger('first')`
- `result.current('second')` → `result.current.trigger('second')`

- [ ] **Step 2: Add three new failing tests for `flush()`**

Append inside the existing `describe('useAutoSave')` block:

```ts
  it('flush() immediately calls saveFn with the latest content', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current.trigger('pending content'))
    expect(saveFn).not.toHaveBeenCalled()

    act(() => result.current.flush())
    expect(saveFn).toHaveBeenCalledWith('pending content')
  })

  it('flush() is a no-op when no timer is pending', () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    expect(() => act(() => result.current.flush())).not.toThrow()
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('flush() cancels the pending timer', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current.trigger('content'))
    act(() => result.current.flush())
    act(() => jest.advanceTimersByTime(2000))

    // saveFn called exactly once (by flush), not again by the timer
    expect(saveFn).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- __tests__/hooks/useAutoSave.test.ts
```

Expected: existing tests fail (wrong return shape) + new tests fail

- [ ] **Step 4: Update `useAutoSave.ts`**

```ts
// src/hooks/useAutoSave.ts
import { useCallback, useEffect, useRef } from 'react'

export function useAutoSave(
  saveFn: (content: string) => Promise<void>,
  delay: number = 2000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContentRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const trigger = useCallback(
    (content: string) => {
      pendingContentRef.current = content
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        pendingContentRef.current = null
        saveFn(content)
      }, delay)
    },
    [saveFn, delay]
  )

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current === null) return Promise.resolve()
    clearTimeout(timerRef.current)
    timerRef.current = null
    const content = pendingContentRef.current
    pendingContentRef.current = null
    if (content !== null) return saveFn(content)
    return Promise.resolve()
  }, [saveFn])

  return { trigger, flush }
}
```

- [ ] **Step 5: Fix call sites broken by the return shape change**

`Editor.tsx` line 32: `const triggerSave = useAutoSave(saveFn, 2000)` → `const { trigger: triggerSave } = useAutoSave(saveFn, 2000)`

`TodoView.tsx` line 36: `const triggerAutoSave = useAutoSave(saveToServer, 500)` → `const { trigger: triggerAutoSave } = useAutoSave(saveToServer, 500)`

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAutoSave.ts src/components/Editor.tsx src/components/TodoView.tsx __tests__/hooks/useAutoSave.test.ts
git commit -m "feat: add flush() to useAutoSave and update call sites"
```

---

## Chunk 3: UI — PasswordModal, FileItem, AppShell, Editor

### Task 5: `PasswordModal` component

**Files:**
- Create: `src/components/PasswordModal.tsx`

- [ ] **Step 1: Implement `PasswordModal.tsx`**

```tsx
// src/components/PasswordModal.tsx
'use client'
import { useState, useEffect, useRef } from 'react'

interface PasswordModalProps {
  filename: string
  mode: 'unlock' | 'set' | 'unset'
  onSubmit: (password: string) => void
  onCancel: () => void
  error?: string
}

const LABELS: Record<PasswordModalProps['mode'], string> = {
  unlock: '비밀번호 입력',
  set: '비밀번호 설정',
  unset: '비공개 해제',
}

export function PasswordModal({
  filename,
  mode,
  onSubmit,
  onCancel,
  error,
}: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const handleSubmit = () => {
    if (mode === 'set' && password !== confirm) {
      setLocalError('비밀번호가 일치하지 않습니다')
      return
    }
    if (!password) return
    setLocalError('')
    onSubmit(password)
  }

  const displayError = error || localError

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
        <h2 className="text-sm font-semibold mb-1">{LABELS[mode]}</h2>
        <p className="text-xs text-gray-400 mb-4 truncate">{filename}</p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="비밀번호"
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {mode === 'set' && (
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="비밀번호 확인"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {displayError && (
          <p className="text-xs text-red-500 mb-2">{displayError}</p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!password}
            className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests (no new unit tests for this pure UI component)**

```bash
pnpm test
```

Expected: all tests PASS (no regressions)

- [ ] **Step 3: Commit**

```bash
git add src/components/PasswordModal.tsx
git commit -m "feat: add PasswordModal component (unlock/set/unset modes)"
```

---

### Task 6: `FileItem` — blur, lock icon, context menu

**Files:**
- Modify: `src/components/FileItem.tsx`

The `FileItem` component needs three changes:
1. Blur the title when `file.isPrivate` is true
2. Show a lock icon before the blurred title
3. Add "비공개로 설정" / "비공개 해제" to the hover actions (notes only)

`FileItem` needs a new `onSetPrivate` / `onUnsetPrivate` prop pair. Because the locking flow requires the current file content (to encrypt it), these callbacks are handled in `AppShell` — `FileItem` just calls them.

- [ ] **Step 1: Update `FileItem.tsx`**

```tsx
'use client'
import { FileEntry } from '@/types'
import { format } from 'date-fns'

interface FileItemProps {
  file: FileEntry
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newTitle: string) => void
  onSetPrivate?: () => void
  onUnsetPrivate?: () => void
  hideTags?: boolean
}

export function FileItem({
  file,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onSetPrivate,
  onUnsetPrivate,
  hideTags,
}: FileItemProps) {
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
        <p className={`text-sm font-medium truncate flex items-center gap-1 ${file.isPrivate ? 'blur-sm select-none' : ''}`}>
          {file.isPrivate && <span className="not-blur">🔒</span>}
          {file.title}
        </p>
        <p className="text-xs text-gray-400">
          {format(new Date(file.updatedAt), 'MM/dd')}
          {!hideTags && !file.isPrivate && file.tags.length > 0 && ` · ${file.tags.map((t) => `#${t}`).join(' ')}`}
        </p>
      </div>
      <div className="hidden group-hover:flex items-center gap-1 ml-2 shrink-0">
        {!file.isPrivate && onSetPrivate && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetPrivate() }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
            title="비공개로 설정"
          >🔒</button>
        )}
        {file.isPrivate && onUnsetPrivate && (
          <button
            onClick={(e) => { e.stopPropagation(); onUnsetPrivate() }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
            title="비공개 해제"
          >🔓</button>
        )}
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

> **Note on blur + icon:** The lock icon 🔒 sits inside the blurred `<p>`. To keep the icon sharp while blurring only the text, move the icon outside the blurred element. Update the JSX:
>
> ```tsx
> <div className="min-w-0 flex-1">
>   <div className="flex items-center gap-1">
>     {file.isPrivate && <span className="text-sm shrink-0">🔒</span>}
>     <p className={`text-sm font-medium truncate ${file.isPrivate ? 'blur-sm select-none' : ''}`}>
>       {file.title}
>     </p>
>   </div>
>   ...
> </div>
> ```

Use the corrected layout shown in the note above (icon outside the blur element), not the initial code block.

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/FileItem.tsx
git commit -m "feat: blur private file titles and add lock/unlock context menu buttons"
```

---

### Task 7: `AppShell` — activePassword state, deferred fetch, modal gate

**Files:**
- Modify: `src/components/AppShell.tsx`

This is the most complex change. Key responsibilities:
- `activePassword: string | null` state — cleared when `activeFilename` changes
- The `useEffect` that fetches content must skip private files (deferred fetch)
- When a private file is selected: show `PasswordModal(mode='unlock')`, fetch+decrypt on submit
- When "비공개로 설정": flush auto-save, show `PasswordModal(mode='set')`, encrypt current content, PUT
- When "비공개 해제": show `PasswordModal(mode='unset')`, fetch+decrypt, PUT plaintext

- [ ] **Step 1: Rewrite `AppShell.tsx`**

```tsx
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FileType, FileEntry } from '@/types'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { Editor } from './Editor'
import { TodoView } from './TodoView'
import { PasswordModal } from './PasswordModal'
import { useFiles } from '@/hooks/useFiles'
import { encrypt, decrypt, CryptoError } from '@/lib/crypto'

type ModalState =
  | { mode: 'unlock'; file: FileEntry }
  | { mode: 'set'; file: FileEntry }
  | { mode: 'unset'; file: FileEntry }
  | null

interface AppShellProps {
  type: FileType
}

export function AppShell({ type }: AppShellProps) {
  const { files, loading, refresh, createFile, deleteFile, renameFile } = useFiles(type)
  const [activeFilename, setActiveFilenameRaw] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState<string>('')
  const [activePassword, setActivePassword] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [modalError, setModalError] = useState<string | undefined>()
  // Ref used by "set private" flow to flush in-flight auto-save
  const flushRef = useRef<(() => Promise<void>) | null>(null)

  // Clear password whenever file changes
  const setActiveFilename = useCallback((filename: string | null) => {
    setActiveFilenameRaw(filename)
    setActivePassword(null)
    setActiveContent('')
  }, [])

  // Fetch content — skip private files (they require password first)
  useEffect(() => {
    if (!activeFilename) return
    const file = files.find((f) => f.filename === activeFilename)
    if (!file || file.isPrivate) return  // private: wait for password
    fetch(`/api/files/${type}/${encodeURIComponent(activeFilename)}`)
      .then((r) => r.json())
      .then((data) => setActiveContent(data.content ?? ''))
  }, [activeFilename, type, files])

  // Auto-select first file on initial load
  useEffect(() => {
    if (!loading && files.length > 0 && !activeFilename) {
      setActiveFilenameRaw(files[0].filename)
    }
  }, [loading, files, activeFilename])

  // ── File selection ──────────────────────────────────────────────
  const handleSelect = (filename: string) => {
    const file = files.find((f) => f.filename === filename)
    if (!file) return
    setActiveFilename(filename)
    if (file.isPrivate) {
      setModal({ mode: 'unlock', file })
      setModalError(undefined)
    }
  }

  // ── Modal submit ────────────────────────────────────────────────
  const handleModalSubmit = async (password: string) => {
    if (!modal) return
    setModalError(undefined)

    if (modal.mode === 'unlock') {
      try {
        const res = await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`)
        const { content } = await res.json()
        const plaintext = await decrypt(content, password)
        setActiveContent(plaintext)
        setActivePassword(password)
        setModal(null)
      } catch (err) {
        if (err instanceof CryptoError && err.code === 'corrupt_format') {
          setModalError('파일이 손상되었습니다')
        } else {
          setModalError('비밀번호가 올바르지 않습니다')
        }
      }
    }

    if (modal.mode === 'set') {
      try {
        // Await flush so any pending auto-save lands before we re-encrypt
        await flushRef.current?.()
        // Use activeContent (already in state — no extra fetch needed)
        const blob = await encrypt(activeContent, password)
        await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: blob }),
        })
        setActivePassword(password)
        setModal(null)
        refresh()
      } catch {
        setModalError('암호화 중 오류가 발생했습니다')
      }
    }

    if (modal.mode === 'unset') {
      try {
        const res = await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`)
        const { content } = await res.json()
        const plaintext = await decrypt(content, password)
        await fetch(`/api/files/${type}/${encodeURIComponent(modal.file.filename)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: plaintext }),
        })
        setActivePassword(null)
        setModal(null)
        // Update displayed content with plaintext
        setActiveContent(plaintext)
        refresh()
      } catch (err) {
        if (err instanceof CryptoError && err.code === 'corrupt_format') {
          setModalError('파일이 손상되었습니다')
        } else {
          setModalError('비밀번호가 올바르지 않습니다')
        }
      }
    }
  }

  // Stable ref so Editor's useEffect doesn't re-fire on every render
  const handleFlushRef = useCallback((flush: () => Promise<void>) => {
    flushRef.current = flush
  }, [])

  // ── CRUD handlers ───────────────────────────────────────────────
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
    }
  }

  const handleRename = async (filename: string, newTitle: string) => {
    const newFilename = await renameFile(filename, newTitle)
    if (newFilename && filename === activeFilename) {
      setActiveFilenameRaw(newFilename)
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  const activeFile = files.find((f) => f.filename === activeFilename)
  const isActivePrivate = activeFile?.isPrivate ?? false
  const showLockedPlaceholder = isActivePrivate && !activePassword

  return (
    <div className="flex flex-col h-screen">
      <TopNav onNewFile={handleNewFile} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          files={files}
          activeFilename={activeFilename}
          type={type}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onRename={handleRename}
          onSetPrivate={type === 'notes'
            ? (filename) => {
                const file = files.find((f) => f.filename === filename)
                if (file) { setModal({ mode: 'set', file }); setModalError(undefined) }
              }
            : undefined}
          onUnsetPrivate={type === 'notes'
            ? (filename) => {
                const file = files.find((f) => f.filename === filename)
                if (file) { setModal({ mode: 'unset', file }); setModalError(undefined) }
              }
            : undefined}
        />
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {showLockedPlaceholder ? (
            <div
              className="flex items-center justify-center h-full text-gray-400 cursor-pointer"
              onClick={() => activeFile && setModal({ mode: 'unlock', file: activeFile })}
            >
              <div className="text-center">
                <p className="text-4xl mb-4">🔒</p>
                <p className="text-sm">비공개 파일입니다. 클릭하여 비밀번호를 입력하세요.</p>
              </div>
            </div>
          ) : activeFilename ? (
            type === 'todos' ? (
              <TodoView
                key={activeFilename}
                content={activeContent}
                filename={activeFilename}
                onSave={refresh}
              />
            ) : (
              <Editor
                key={activeFilename}
                content={activeContent}
                filename={activeFilename}
                type={type}
                password={activePassword ?? undefined}
                onSave={refresh}
                onFlushRef={handleFlushRef}
              />
            )
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

      {modal && (
        <PasswordModal
          filename={modal.file.filename}
          mode={modal.mode}
          onSubmit={handleModalSubmit}
          onCancel={() => setModal(null)}
          error={modalError}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `Sidebar.tsx`**

Add the two optional props to `SidebarProps` and thread them to the existing `<FileItem>` in the search-results branch and to `<TagTree>`:

```tsx
// Add to SidebarProps:
onSetPrivate?: (filename: string) => void
onUnsetPrivate?: (filename: string) => void
```

In the search-results `FileItem` (already rendered in Sidebar when `search` is non-empty), add:
```tsx
onSetPrivate={onSetPrivate ? () => onSetPrivate(file.filename) : undefined}
onUnsetPrivate={onUnsetPrivate ? () => onUnsetPrivate(file.filename) : undefined}
```

Pass both props to `<TagTree>`:
```tsx
<TagTree
  root={tagTree}
  activeFilename={activeFilename}
  onSelect={onSelect}
  onDelete={onDelete}
  onRename={onRename}
  onSetPrivate={onSetPrivate}
  onUnsetPrivate={onUnsetPrivate}
/>
```

- [ ] **Step 3: Update `TagTree.tsx`**

`TagTree` has two internal structures that render `FileItem`: the untagged section and `TagNodeRow`. Both must thread the new props.

Add to **both** `TagTreeProps` and `TagNodeRowProps`:
```ts
onSetPrivate?: (filename: string) => void
onUnsetPrivate?: (filename: string) => void
```

In the **untagged section** `FileItem` calls (inside `TagTree`):
```tsx
onSetPrivate={onSetPrivate ? () => onSetPrivate(file.filename) : undefined}
onUnsetPrivate={onUnsetPrivate ? () => onUnsetPrivate(file.filename) : undefined}
```

In **`TagNodeRow`**'s recursive `<TagNodeRow>` call, pass `onSetPrivate` and `onUnsetPrivate` through.

In **`TagNodeRow`**'s `FileItem` calls (inside the `sortedFiles.map`):
```tsx
onSetPrivate={onSetPrivate ? () => onSetPrivate(file.filename) : undefined}
onUnsetPrivate={onUnsetPrivate ? () => onUnsetPrivate(file.filename) : undefined}
```

In the `TagTree` function's `<TagNodeRow>` call, pass both props through.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx src/components/Sidebar.tsx src/components/TagTree.tsx
git commit -m "feat: AppShell — activePassword state, modal gate, deferred fetch for private files"
```

---

### Task 8: `Editor` — password prop, encrypt-before-save, flushRef

**Files:**
- Modify: `src/components/Editor.tsx`

- [ ] **Step 1: Update `Editor.tsx`**

```tsx
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
import { encrypt } from '@/lib/crypto'

interface EditorProps {
  content: string
  filename: string
  type: 'notes' | 'todos'
  password?: string
  onSave?: (filename: string) => void
  onFlushRef?: (flush: () => Promise<void>) => void
}

export function Editor({ content, filename, type, password, onSave, onFlushRef }: EditorProps) {
  const saveFn = useCallback(
    async (markdownContent: string) => {
      const body = password
        ? await encrypt(markdownContent, password)
        : markdownContent
      await fetch(`/api/files/${type}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body }),
      })
      onSave?.(filename)
    },
    [filename, type, password, onSave]
  )

  const { trigger: triggerSave, flush } = useAutoSave(saveFn, 2000)

  // Expose flush to AppShell so "set private" can flush before re-encrypting
  useEffect(() => {
    onFlushRef?.(flush)
  }, [flush, onFlushRef])

  const editor = useEditor({
    immediatelyRender: false,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown()
      triggerSave(markdown)
    },
  })

  useEffect(() => {
    if (!editor) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as any).markdown.getMarkdown()
    if (current !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      {password && (
        <div className="flex items-center gap-1 px-4 py-1 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
          <span>🔒</span>
          <span>비공개 파일</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Step 3: Start dev server and manually verify end-to-end**

```bash
pnpm dev
```

Manual test checklist:
- [ ] Create a new note and set it as private → title blurs in sidebar
- [ ] Click the blurred file → `PasswordModal` appears
- [ ] Enter correct password → file opens in editor with 🔒 badge
- [ ] Edit and wait 2s → content saves encrypted (check `data/notes/` file starts with `PRIVATE:`)
- [ ] Click another file and back → password prompt appears again
- [ ] Enter wrong password → "비밀번호가 올바르지 않습니다" error
- [ ] Right-click private file → "비공개 해제" → enter password → file becomes plain

- [ ] **Step 4: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat: Editor encrypts content before save when password is set"
```

---

## Final

- [ ] **Run full test suite one last time**

```bash
pnpm test
```

Expected: all tests PASS

- [ ] **Run lint**

```bash
pnpm lint
```

Expected: no errors

- [ ] **Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: fix any lint issues from private notes implementation"
```
