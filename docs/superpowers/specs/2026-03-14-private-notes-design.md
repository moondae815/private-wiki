# Private Notes Feature — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Summary

Add file-level private notes to the existing markdown wiki. Each note can be individually locked with a password. The file contents are encrypted using AES-GCM with a PBKDF2-derived key (Web Crypto API). The password is entered every time the file is opened. There is no recovery mechanism — losing the password means losing access to the file.

---

## 1. File Format

Private files use the existing `.md` extension and folder structure (`data/notes/`, `data/todos/`). The file content is replaced with a single-line encrypted blob:

```
PRIVATE:<salt_hex>:<iv_base64>:<ciphertext_base64>
```

| Field | Size | Description |
|---|---|---|
| `salt_hex` | 32 bytes (hex) | Random salt for PBKDF2 |
| `iv_base64` | 12 bytes (base64) | AES-GCM initialization vector |
| `ciphertext_base64` | variable (base64) | AES-GCM encrypted markdown content |

A file is identified as private if and only if its content starts with `PRIVATE:`.

---

## 2. Encryption Layer — `src/lib/crypto.ts`

Two public functions:

```ts
encrypt(plaintext: string, password: string): Promise<string>
// Returns "PRIVATE:<salt_hex>:<iv_base64>:<ciphertext_base64>"

decrypt(encrypted: string, password: string): Promise<string>
// Returns the original markdown string
// Throws if the password is wrong or the format is invalid
```

### Internals

- Key derivation: PBKDF2, SHA-256, 100,000 iterations, 256-bit output
- Encryption: AES-GCM, 256-bit key, 12-byte random IV
- All crypto via browser-native `window.crypto.subtle` (Web Crypto API)
- The password never leaves the client

### `isPrivate(content: string): boolean`

Returns `true` if `content.startsWith('PRIVATE:')`. Used by both server and client.

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

---

## 4. API Changes

All changes are additive — no breaking changes to existing endpoints.

### `GET /api/files?type=...`

- Server reads file content to determine `isPrivate`
- Sets `tags: []` for private files (cannot extract tags from encrypted content)
- Returns `isPrivate: boolean` in each `FileEntry`

### `GET /api/files/[type]/[filename]`

- Returns encrypted blob as-is for private files (`content: "PRIVATE:..."`)
- No decryption on the server — the server never sees the password

### `PUT /api/files/[type]/[filename]`

- Client sends already-encrypted `PRIVATE:...` string in the request body
- Server writes it as-is — no change needed

### `POST /api/files`

- No change for new file creation — initial content is empty, encryption happens on first save

---

## 5. Data Flow

### Opening a private file

1. User clicks a blurred file item in the sidebar
2. `PasswordModal` appears, user enters password
3. Client fetches `GET /api/files/[type]/[filename]` → receives `PRIVATE:...` blob
4. Client calls `decrypt(blob, password)`
   - Success → editor renders the decrypted markdown
   - Failure (wrong password or corrupt data) → inline error message in modal
5. Password is held in component state only for the duration of the session (discarded when another file is selected)

### Saving a private file

1. `useAutoSave` calls `encrypt(content, password)` before sending
2. Sends `PUT` with the encrypted blob
3. Server writes the blob — no change to server logic

### Making a file private

1. User right-clicks a normal file → "비공개로 설정"
2. Modal prompts for a new password (+ confirmation field)
3. Client reads current content, encrypts it, sends `PUT`
4. `FileEntry.isPrivate` becomes `true` after list refresh

### Removing private status

1. User clicks "비공개 해제" from the context menu
2. Modal prompts for current password
3. Client fetches encrypted blob, decrypts it, sends `PUT` with plaintext
4. `FileEntry.isPrivate` becomes `false` after list refresh

---

## 6. UI Components

### Sidebar — `FileItem.tsx`

- If `file.isPrivate`:
  - File title rendered with `blur-sm` CSS class
  - Lock icon (🔒) shown before the title
  - Click opens `PasswordModal` instead of loading the file directly
- Context menu additions:
  - Normal file: "비공개로 설정" option
  - Private file: "비공개 해제" option

### `PasswordModal.tsx` (new component)

Props:
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
- `set`: password + confirmation fields ("비밀번호 설정")
- `unset`: single password field to verify before removing encryption
- `Enter` key submits, `Escape` cancels
- Inline error message shown below input when `error` prop is set

### Editor — `Editor.tsx`

- Accepts optional `password` prop
- When `password` is set, shows a small lock badge in the toolbar area
- `useAutoSave` receives `password` and encrypts content before saving

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| Wrong password | `decrypt()` throws → modal shows "비밀번호가 올바르지 않습니다" |
| Corrupt file (truncated blob) | `decrypt()` throws → same error message |
| Web Crypto not available | `encrypt()`/`decrypt()` throw → show "이 브라우저는 지원되지 않습니다" |
| Password lost | No recovery. File remains encrypted on disk. |

---

## 8. Security Properties

- Encryption key is derived from the password using PBKDF2 (100k iterations, SHA-256)
- Each file uses a unique random salt and IV
- AES-GCM provides both confidentiality and integrity (tampering is detectable)
- The password is never sent over the network or written to disk
- No master key or recovery mechanism (by design)

---

## 9. Out of Scope

- Full-text search within private files (search API cannot decrypt content)
- Tag extraction from private files
- Password hints or recovery
- Multiple passwords per file
