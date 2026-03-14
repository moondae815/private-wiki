# Private Notes Feature — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Summary

Add file-level private notes to the existing markdown wiki. Each note can be individually locked with a password. The file contents are encrypted using AES-GCM with a PBKDF2-derived key (Web Crypto API). The password is entered every time the file is opened. There is no recovery mechanism — losing the password means losing access to the file.

**Scope:** Private notes only (`data/notes/`). Private todos are out of scope — `TodoView` has a fundamentally different data model (parsed item list, immediate checkbox saves) that makes encrypt-before-save significantly more complex. The "비공개로 설정" option will not appear in the todos context menu.

---

## 1. File Format

Private files use the existing `.md` extension and folder structure (`data/notes/`). The file content is replaced with a single-line encrypted blob:

```
PRIVATE:<salt_b64>:<iv_b64>:<ciphertext_b64>
```

| Field | Size | Description |
|---|---|---|
| `salt_b64` | 32 bytes, standard base64 | Random salt for PBKDF2 |
| `iv_b64` | 12 bytes, standard base64 | AES-GCM initialization vector |
| `ciphertext_b64` | variable, standard base64 | AES-GCM encrypted markdown content |

All three fields use **standard base64** (`btoa`/`atob`), not base64url. Standard base64 characters (`+`, `/`, `=`) are safe within this format because `:` is the delimiter. A file is identified as private if and only if its content starts with `PRIVATE:`.

**Note on filename:** The filename (and therefore the title shown in the sidebar) is not encrypted. The title is blurred in the UI but readable on disk. Users should avoid putting sensitive information in the filename itself.

---

## 2. Module Boundary

### `src/lib/fileFormat.ts` (new, shared)

A thin, dependency-free module importable by both server (Node.js) and client:

```ts
export function isPrivate(content: string): boolean
// Returns true if content.startsWith('PRIVATE:')
```

No imports, no browser or Node.js APIs — safe to use anywhere.

### `src/lib/crypto.ts` (new, client-only)

Wraps Web Crypto API. **Must never be imported by server-side code** (`src/app/api/` or `src/lib/files.ts`).

```ts
export class CryptoError extends Error {
  constructor(public code: 'wrong_password' | 'corrupt_format', message: string)
}

export async function encrypt(plaintext: string, password: string): Promise<string>
// Returns "PRIVATE:<salt_b64>:<iv_b64>:<ciphertext_b64>"

export async function decrypt(encrypted: string, password: string): Promise<string>
// Returns the original markdown string
// Throws CryptoError('wrong_password') if AES-GCM authentication fails
// Throws CryptoError('corrupt_format') if the blob is missing fields or contains invalid base64
```

### Internals

- Key derivation: PBKDF2, SHA-256, 100,000 iterations, 256-bit key
- Encryption: AES-GCM, 256-bit key, 12-byte random IV, 32-byte random salt
- All crypto via `window.crypto.subtle` (Web Crypto API)
- The password never leaves the client

---

## 3. Type Changes

### `FileEntry` (src/types/index.ts)

```ts
export interface FileEntry {
  filename: string
  title: string
  type: FileType
  tags: string[]        // empty array for private files (content not readable)
  createdAt: string
  updatedAt: string
  isPrivate: boolean    // NEW
}
```

No changes to `UpdateFileRequest` or `CreateFileRequest` — the server never needs to know about encryption.

---

## 4. API Changes

All changes are additive — no breaking changes to existing endpoints.

### `GET /api/files?type=...`

- Server uses `isPrivate()` from `src/lib/fileFormat.ts` to determine private status
- Sets `tags: []` for private files (cannot extract tags from encrypted content)
- Returns `isPrivate: boolean` in each `FileEntry`

### `GET /api/files/[type]/[filename]`

- Returns encrypted blob as-is for private files (`content: "PRIVATE:..."`)
- No decryption on the server — the server never sees the password

### `PUT /api/files/[type]/[filename]`

- Client sends already-encrypted `PRIVATE:...` string in the request body
- Server writes it as-is — no change needed
- Rename (`newTitle` body field) continues to work unchanged for private files — it is a filesystem `rename()` that does not touch file content

### `POST /api/files`

- No change — the server creates a new file with `# {title}\n\n` as plaintext
- A file only becomes private when the user explicitly chooses "비공개로 설정" from the context menu. There is no implicit encryption on first save.

---

## 5. Data Flow

### Opening a private file (click in sidebar)

1. User clicks a blurred file item in the sidebar
2. `AppShell` checks `file.isPrivate` — if true, shows `PasswordModal` (mode: `'unlock'`) and **does not fetch content yet**
3. User enters password and submits
4. `AppShell` fetches `GET /api/files/[type]/[filename]` → receives `PRIVATE:...` blob
5. `AppShell` calls `decrypt(blob, password)`
   - `CryptoError('wrong_password')` → modal stays open, shows "비밀번호가 올바르지 않습니다"
   - `CryptoError('corrupt_format')` → modal shows "파일이 손상되었습니다"
   - Success → `setActiveContent(plaintext)`, `setActivePassword(password)`, modal closes, editor renders
6. The existing `useEffect` that fetches on `activeFilename` change must guard: skip fetch if `file.isPrivate` is true (content fetch is deferred to step 4 above)

### Auto-selected private file on load

`AppShell` auto-selects `files[0]` on first load. If that file is private, the editor area shows a locked placeholder with the message "비공개 파일입니다. 클릭하여 비밀번호를 입력하세요." Clicking the placeholder opens `PasswordModal`. Private files are not skipped during auto-selection.

If the user cancels the modal, `activeFilename` remains set and the locked placeholder stays visible. No other file is selected automatically.

### Saving a private file

- `Editor.tsx` receives `password?: string` as a prop
- When `password` is set, the `saveFn` closure passed to `useAutoSave` is:
  ```ts
  async (content: string) => {
    const blob = await encrypt(content, password!)
    await PUT(blob)
  }
  ```
- `useAutoSave` signature is unchanged
- The timer is cancelled on unmount via `useAutoSave`'s cleanup `useEffect`. Since `AppShell` always renders `Editor` with `key={activeFilename}`, switching files unmounts the old `Editor` and cancels any in-flight save timer. `activePassword` is then cleared. This guarantees no stale-password saves occur after file switch.

### Making a file private

1. User right-clicks a normal file → "비공개로 설정"
2. `PasswordModal` (mode: `'set'`) prompts for new password + confirmation field
3. Before fetching, `AppShell` waits for any in-flight auto-save to settle (flush: the current `saveFn` is called immediately if a timer is pending — this requires `useAutoSave` to expose a `flush()` function)
4. Client fetches current plaintext content, encrypts it, sends `PUT`
5. `FileEntry.isPrivate` becomes `true` after list refresh

### Removing private status

1. User right-clicks a private file → "비공개 해제"
2. `PasswordModal` (mode: `'unset'`) prompts for current password
3. Client fetches encrypted blob, decrypts it, sends `PUT` with plaintext
4. `activePassword` is cleared, `FileEntry.isPrivate` becomes `false` after list refresh

---

## 6. UI Components

### Sidebar — `FileItem.tsx`

- If `file.isPrivate`:
  - File title rendered with `blur-sm` CSS class
  - Lock icon (🔒) shown before the title
  - Click triggers `onSelect` as usual — `AppShell` handles the modal gate
- Context menu additions (notes only):
  - Normal note: "비공개로 설정" option
  - Private note: "비공개 해제" option

### `PasswordModal.tsx` (new component)

```ts
interface PasswordModalProps {
  filename: string
  mode: 'unlock' | 'set' | 'unset'
  onSubmit: (password: string) => void
  onCancel: () => void
  error?: string
}
```

- `unlock`: single password field ("비밀번호 입력")
- `set`: password + confirmation fields ("비밀번호 설정") — submit disabled until both fields match; shows "비밀번호가 일치하지 않습니다" inline if mismatched on submit
- `unset`: single password field to verify before removing encryption
- `Enter` key submits, `Escape` cancels
- Inline error message shown below input when `error` prop is set

### Editor — `Editor.tsx`

- Accepts optional `password?: string` prop (no change to public interface if password is undefined — normal notes continue to work unchanged)
- When `password` is set, shows a small lock badge (🔒) in the toolbar area
- `saveFn` closure captures `password` and calls `encrypt` before `PUT`

### `AppShell.tsx`

- Adds `activePassword: string | null` to state
- `activePassword` is cleared whenever `activeFilename` changes
- Renders `<PasswordModal>` as an overlay when a private file is selected and no password is entered yet
- Passes `password={activePassword ?? undefined}` to `Editor`

### `useAutoSave` — `src/hooks/useAutoSave.ts`

- Exposes a `flush()` function alongside the `trigger` return value:
  ```ts
  return { trigger, flush }
  // flush(): immediately invokes saveFn with the latest content if a timer is pending
  ```
- Used by "비공개로 설정" flow to ensure content is saved before encryption begins

---

## 7. Error Handling

| Scenario | Error | UI message |
|---|---|---|
| Wrong password | `CryptoError('wrong_password')` | "비밀번호가 올바르지 않습니다" |
| Corrupt file (malformed blob) | `CryptoError('corrupt_format')` | "파일이 손상되었습니다" |
| Password mismatch in 'set' mode | client-side validation | "비밀번호가 일치하지 않습니다" |
| Web Crypto not available | feature detection on mount | "이 브라우저는 지원되지 않습니다" |
| Password lost | — | No recovery. File remains encrypted on disk. |

---

## 8. Security Properties

- Encryption key is derived from the password using PBKDF2 (100k iterations, SHA-256)
- Each file uses a unique random salt and IV — encrypting the same content twice produces different blobs
- AES-GCM provides both confidentiality and integrity (tampering surfaces as `wrong_password` error)
- The password is never sent over the network or written to disk
- No master key or recovery mechanism (by design)
- **Filename is not encrypted:** The title derived from the filename is blurred in the UI but readable on disk. Users should avoid sensitive information in filenames.

---

## 9. Out of Scope

- Private todos (`TodoView` uses a parsed item list model incompatible with encrypt-before-save)
- Full-text search within private files (search API cannot decrypt content)
- Tag extraction from private files
- Password hints or recovery
- Multiple passwords per file
- Filename/title encryption
