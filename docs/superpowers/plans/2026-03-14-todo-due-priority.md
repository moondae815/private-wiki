# Todo Due Date & Priority Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `type === 'todos'`일 때 Tiptap 에디터 대신 커스텀 TodoView를 렌더링하고, 각 항목에 due date picker + priority 드롭다운을 제공한다.

**Architecture:** 마크다운 파일을 라인 파싱해 `TodoItem[]`으로 변환하고, 커스텀 React 컴포넌트로 렌더링한다. 변경사항은 직렬화 후 기존 REST API(`PUT /api/files/todos/{filename}`)에 저장한다. Notes 타입은 변경 없음.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Jest + jsdom

---

## Chunk 1: 파서/직렬라이저 (`src/lib/todos.ts`)

**직렬화 알고리즘 원칙 (구현 전 숙지):**
- 순서 기반(positional) 매핑: N번째 TodoItem → latestContent의 N번째 todo 라인
- `[X]` (대문자) 는 지원하지 않음 (파싱 대상 외) — 테스트로 명시
- `serializeItem`은 빈 텍스트일 때 `- [ ]` (후행 공백 없음) 으로 직렬화
- 정규식은 `/^- \[([ x])\] ?(.*)$/` (체크박스 뒤 공백 선택적), 캡처 그룹 2는 항상 `.trim()` 처리
- `latestContent`는 항상 마지막에 `\n`이 있는 형태로 간주. 직렬화 후에도 끝의 `\n` 1개를 유지

### Task 1: 파서 구현 (TDD)

**Files:**
- Create: `src/lib/todos.ts`
- Create: `__tests__/lib/todos.test.ts`

- [ ] **Step 1: 파싱 테스트 작성**

`__tests__/lib/todos.test.ts`:

```typescript
import { parseMarkdownToItems, serializeItemsToMarkdown } from '@/lib/todos'

describe('parseMarkdownToItems', () => {
  it('체크 안 된 항목을 파싱한다', () => {
    const content = '- [ ] 할 일'
    const items = parseMarkdownToItems(content)
    expect(items).toHaveLength(1)
    expect(items[0].checked).toBe(false)
    expect(items[0].text).toBe('할 일')
    expect(items[0].due).toBeNull()
    expect(items[0].priority).toBeNull()
  })

  it('체크된 항목을 파싱한다', () => {
    const items = parseMarkdownToItems('- [x] 완료')
    expect(items[0].checked).toBe(true)
    expect(items[0].text).toBe('완료')
  })

  it('@due와 @priority를 파싱하고 text에서 완전히 제거한다', () => {
    const items = parseMarkdownToItems('- [ ] 작업 @due:2025-03-20 @priority:high')
    expect(items[0].text).toBe('작업')          // 어노테이션 없는 순수 텍스트
    expect(items[0].due).toBe('2025-03-20')
    expect(items[0].priority).toBe('high')
  })

  it('텍스트 없는 항목(- [ ] , 후행 공백 포함)을 빈 text로 파싱한다', () => {
    // 후행 공백 있는 형태와 없는 형태 모두 text === '' 이어야 함
    expect(parseMarkdownToItems('- [ ] ')[0].text).toBe('')
    expect(parseMarkdownToItems('- [ ]')[0].text).toBe('')
  })

  it('[X] 대문자 체크박스는 todo로 파싱하지 않는다', () => {
    const items = parseMarkdownToItems('- [X] 완료')
    expect(items).toHaveLength(0)
  })

  it('비-todo 라인은 무시한다', () => {
    const content = '# 제목\n\n- [ ] 할 일\n\n일반 텍스트'
    const items = parseMarkdownToItems(content)
    expect(items).toHaveLength(1)
  })

  it('각 항목에 고유 id를 부여한다', () => {
    const content = '- [ ] 첫번째\n- [ ] 두번째'
    const items = parseMarkdownToItems(content)
    expect(items[0].id).not.toBe(items[1].id)
    expect(typeof items[0].id).toBe('string')
  })

  it('todo 사이에 끼어 있는 비-todo 라인은 무시한다', () => {
    const content = '- [ ] 첫번째\n- 일반 불릿\n- [ ] 두번째'
    const items = parseMarkdownToItems(content)
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('첫번째')
    expect(items[1].text).toBe('두번째')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/git-root/private-wiki && pnpm test -- __tests__/lib/todos.test.ts
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: `parseMarkdownToItems`만 구현 (serializeItemsToMarkdown은 stub)**

`src/lib/todos.ts`:

```typescript
import { extractTodoMetadata } from './markdown'

export interface TodoItem {
  id: string
  checked: boolean
  text: string
  due: string | null
  priority: 'high' | 'medium' | 'low' | null
}

export function parseMarkdownToItems(content: string): TodoItem[] {
  const lines = content.split('\n')
  const items: TodoItem[] = []

  for (const line of lines) {
    // [ ] 또는 [x] 만 지원 (대문자 X 제외)
    // 체크박스 뒤 공백 선택적 (?), 캡처 그룹 2는 trim()
    const match = line.match(/^- \[([ x])\] ?(.*)$/)
    if (!match) continue

    const checked = match[1] === 'x'
    const rawText = match[2].trim()
    const metadata = extractTodoMetadata(rawText)
    const text = rawText
      .replace(/@due:\S+/g, '')
      .replace(/@priority:\S+/g, '')
      .trim()

    items.push({
      id: crypto.randomUUID(),
      checked,
      text,
      due: metadata.due,
      priority: metadata.priority,
    })
  }

  return items
}

// stub — Task 2에서 구현
// 반환값: content를 그대로 반환 (Task 1 테스트가 이 함수를 호출하지 않으므로 안전)
export function serializeItemsToMarkdown(
  _items: TodoItem[],
  latestContent: string
): string {
  return latestContent
}
```

- [ ] **Step 4: 파싱 테스트 통과 확인**

```bash
pnpm test -- __tests__/lib/todos.test.ts --testNamePattern="parseMarkdownToItems"
```

Expected: PASS (7 tests)

---

### Task 2: 직렬라이저 구현 (TDD)

- [ ] **Step 5: 직렬화 테스트 추가**

`__tests__/lib/todos.test.ts`에 추가:

```typescript
describe('serializeItemsToMarkdown', () => {
  it('비-todo 라인(제목, 빈줄)을 원위치에 보존한다', () => {
    const content = '# 제목\n\n- [ ] 할 일\n\n일반 텍스트'
    const items = parseMarkdownToItems(content)
    items[0].checked = true
    const result = serializeItemsToMarkdown(items, content)
    expect(result).toContain('# 제목')
    expect(result).toContain('일반 텍스트')
    expect(result).toContain('- [x] 할 일')
  })

  it('@due와 @priority를 직렬화한다', () => {
    const content = '- [ ] 작업'
    const items = parseMarkdownToItems(content)
    items[0].due = '2025-03-20'
    items[0].priority = 'high'
    const result = serializeItemsToMarkdown(items, content)
    expect(result).toContain('- [ ] 작업 @due:2025-03-20 @priority:high')
  })

  it('새 항목 추가 시 마지막 todo 라인 바로 뒤에 삽입된다', () => {
    const content = '# 제목\n- [ ] 기존\n'
    const items = parseMarkdownToItems(content)
    items.push({ id: 'new', checked: false, text: '새 항목', due: null, priority: null })
    const result = serializeItemsToMarkdown(items, content)
    const lines = result.split('\n')
    const existingIdx = lines.indexOf('- [ ] 기존')
    const newIdx = lines.indexOf('- [ ] 새 항목')
    expect(existingIdx).toBeGreaterThanOrEqual(0)
    expect(newIdx).toBe(existingIdx + 1)
  })

  it('todo 사이에 낀 비-todo 라인을 원위치에 보존한다', () => {
    const content = '- [ ] 첫번째\n- 일반 불릿\n- [ ] 두번째'
    const items = parseMarkdownToItems(content)
    const result = serializeItemsToMarkdown(items, content)
    const lines = result.split('\n')
    // 순서: todo[0], 일반불릿, todo[1]
    const bulletIdx = lines.indexOf('- 일반 불릿')
    const first = lines.indexOf('- [ ] 첫번째')
    const second = lines.indexOf('- [ ] 두번째')
    expect(bulletIdx).toBe(first + 1)
    expect(second).toBe(bulletIdx + 1)
  })

  it('빈 text 항목을 "- [ ]"로 직렬화한다 (후행 공백 없음)', () => {
    // content의 후행 공백 있는 형태에서도 "- [ ]"로 직렬화되어야 함
    const content = '- [ ] \n'
    const items = parseMarkdownToItems(content)
    expect(items[0].text).toBe('')
    const result = serializeItemsToMarkdown(items, content)
    const lines = result.split('\n').filter(Boolean)
    expect(lines[0]).toBe('- [ ]')
  })

  it('항목 수가 줄었을 때 (순서 기반) 마지막 todo 라인을 제거한다', () => {
    const content = '- [ ] 첫번째\n- [ ] 두번째\n- [ ] 세번째\n'
    const items = parseMarkdownToItems(content)
    const reduced = items.slice(0, 2)
    const result = serializeItemsToMarkdown(reduced, content)
    expect(result).toContain('- [ ] 첫번째')
    expect(result).toContain('- [ ] 두번째')
    expect(result).not.toContain('세번째')
  })

  it('todo 라인이 없는 content에 새 항목을 추가한다', () => {
    const content = '# 제목\n'
    const items = [{ id: '1', checked: false, text: '새 할일', due: null, priority: null }]
    const result = serializeItemsToMarkdown(items, content)
    expect(result).toContain('# 제목')
    expect(result).toContain('- [ ] 새 할일')
  })

  it('새 항목 추가 시 기존 todo 라인 바로 뒤에 삽입 (trailing newline 이중 삽입 없음)', () => {
    const content = '# 제목\n- [ ] 기존\n'
    const items = parseMarkdownToItems(content)
    items.push({ id: 'new', checked: false, text: '새 항목', due: null, priority: null })
    const result = serializeItemsToMarkdown(items, content)
    // 이중 빈줄 없어야 함
    expect(result).not.toMatch(/\n\n\n/)
    const lines = result.split('\n')
    const existingIdx = lines.indexOf('- [ ] 기존')
    expect(lines[existingIdx + 1]).toBe('- [ ] 새 항목')
  })
})
```

- [ ] **Step 6: 직렬화 테스트 실패 확인**

```bash
pnpm test -- __tests__/lib/todos.test.ts --testNamePattern="serializeItemsToMarkdown"
```

Expected: FAIL (`not implemented`)

- [ ] **Step 7: `serializeItemsToMarkdown` 구현**

`src/lib/todos.ts`의 stub을 아래로 교체:

```typescript
export function serializeItemsToMarkdown(
  items: TodoItem[],
  latestContent: string
): string {
  const lines = latestContent.split('\n')

  // 순서 기반: N번째 todo 라인 인덱스를 수집
  const todoIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^- \[([ x])\] /.test(lines[i]) || lines[i] === '- [ ] ' || lines[i] === '- [x] ') {
      todoIndices.push(i)
    }
  }

  const serialized = items.map(serializeItem)

  if (todoIndices.length === 0) {
    // todo 라인이 없으면 끝에 추가
    return latestContent.trimEnd() + '\n' + serialized.join('\n') + '\n'
  }

  const result = [...lines]

  if (serialized.length <= todoIndices.length) {
    // 항목 수가 줄었거나 같음: 앞에서부터 교체, 남은 인덱스를 뒤에서부터 제거
    for (let i = 0; i < serialized.length; i++) {
      result[todoIndices[i]] = serialized[i]
    }
    for (const idx of [...todoIndices.slice(serialized.length)].reverse()) {
      result.splice(idx, 1)
    }
  } else {
    // 항목 수가 늘었음: 기존 위치에 교체 후 마지막 todo 라인 뒤에 나머지 추가
    for (let i = 0; i < todoIndices.length; i++) {
      result[todoIndices[i]] = serialized[i]
    }
    const insertAt = todoIndices[todoIndices.length - 1] + 1
    result.splice(insertAt, 0, ...serialized.slice(todoIndices.length))
  }

  return result.join('\n')
}

function serializeItem(item: TodoItem): string {
  const check = item.checked ? 'x' : ' '
  const parts: string[] = []
  if (item.text) parts.push(item.text)
  if (item.due) parts.push(`@due:${item.due}`)
  if (item.priority) parts.push(`@priority:${item.priority}`)
  return `- [${check}]${parts.length ? ' ' + parts.join(' ') : ''}`
}
```

- [ ] **Step 8: 전체 todos 테스트 통과 확인**

```bash
pnpm test -- __tests__/lib/todos.test.ts
```

Expected: PASS (17 tests)

- [ ] **Step 9: 커밋**

```bash
git add src/lib/todos.ts __tests__/lib/todos.test.ts
git commit -m "feat: add todo markdown parser and serializer"
```

---

## Chunk 2: UI 컴포넌트

### Task 2: `PriorityDropdown` 컴포넌트

**Files:**
- Create: `src/components/PriorityDropdown.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/PriorityDropdown.tsx`:

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import type { TodoItem } from '@/lib/todos'

type Priority = TodoItem['priority']

const PRIORITY_LABELS: Record<NonNullable<Priority>, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}

const PRIORITY_COLORS: Record<NonNullable<Priority>, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

interface PriorityDropdownProps {
  value: Priority
  onChange: (value: Priority) => void
}

export function PriorityDropdown({ value, onChange }: PriorityDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const triggerClass = value
    ? `${PRIORITY_COLORS[value]} text-xs px-2 py-0.5 rounded-full cursor-pointer`
    : 'text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? PRIORITY_LABELS[value] : '+ 우선순위'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[80px]">
          {(['high', 'medium', 'low'] as NonNullable<Priority>[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${value === p ? 'font-semibold' : ''}`}
              onClick={() => { onChange(p); setOpen(false) }}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              {PRIORITY_LABELS[p]}
            </button>
          ))}
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => { onChange(null); setOpen(false) }}
          >
            없음
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/PriorityDropdown.tsx
git commit -m "feat: add PriorityDropdown component"
```

---

### Task 3: `DatePickerPopover` 컴포넌트

**Files:**
- Create: `src/components/DatePickerPopover.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/DatePickerPopover.tsx`:

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'

interface DatePickerPopoverProps {
  value: string | null   // "YYYY-MM-DD" or null
  onChange: (value: string | null) => void
}

function isOverdue(date: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return date < today
}

export function DatePickerPopover({ value, onChange }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [textInput, setTextInput] = useState(value ?? '')
  const ref = useRef<HTMLDivElement>(null)

  // 팝오버가 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (open) setTextInput(value ?? '')
  }, [open, value])

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleTextChange = (raw: string) => {
    setTextInput(raw)
    // 완전한 YYYY-MM-DD 형식일 때만 date input 업데이트 (부분 입력 시 date input 건드리지 않음)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      onChange(raw)
    }
  }

  const handleDateChange = (v: string) => {
    setTextInput(v)
    onChange(v || null)
  }

  const handleRemove = () => {
    onChange(null)
    setOpen(false)
  }

  const badgeClass = value
    ? isOverdue(value)
      ? 'text-xs px-2 py-0.5 rounded-full cursor-pointer bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : 'text-xs px-2 py-0.5 rounded-full cursor-pointer bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    : 'text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={badgeClass}
        onClick={() => setOpen((o) => !o)}
      >
        {value ?? '+ 날짜'}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-[200px]">
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={textInput}
            onChange={(e) => handleTextChange(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          />
          <input
            type="date"
            value={textInput.match(/^\d{4}-\d{2}-\d{2}$/) ? textInput : ''}
            onChange={(e) => handleDateChange(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          />
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700 text-left"
            >
              날짜 제거
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/DatePickerPopover.tsx
git commit -m "feat: add DatePickerPopover component"
```

---

### Task 4: `TodoItem` 컴포넌트

**Files:**
- Create: `src/components/TodoItem.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/TodoItem.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { TodoItem as TodoItemType } from '@/lib/todos'
import { DatePickerPopover } from './DatePickerPopover'
import { PriorityDropdown } from './PriorityDropdown'

interface TodoItemProps {
  item: TodoItemType
  onChange: (updated: TodoItemType) => void
}

export function TodoItem({ item, onChange }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)

  const update = (patch: Partial<TodoItemType>) =>
    onChange({ ...item, ...patch })

  const commitText = () => {
    setEditing(false)
    if (editText.trim() !== item.text) {
      update({ text: editText.trim() })
    }
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${item.checked ? 'opacity-60' : ''}`}>
      {/* 체크박스 */}
      <input
        type="checkbox"
        checked={item.checked}
        onChange={(e) => update({ checked: e.target.checked })}
        className="w-4 h-4 rounded shrink-0 cursor-pointer accent-blue-500"
      />

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText()
              if (e.key === 'Escape') { setEditing(false); setEditText(item.text) }
            }}
            className="w-full text-sm bg-transparent border-b border-blue-400 outline-none text-gray-800 dark:text-gray-200"
          />
        ) : (
          <span
            onDoubleClick={() => { setEditing(true); setEditText(item.text) }}
            className={`text-sm cursor-text select-none ${item.checked ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
          >
            {item.text || <span className="text-gray-300 dark:text-gray-600 italic">빈 항목</span>}
          </span>
        )}
      </div>

      {/* 메타데이터 배지 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <DatePickerPopover
          value={item.due}
          onChange={(due) => update({ due })}
        />
        <PriorityDropdown
          value={item.priority}
          onChange={(priority) => update({ priority })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/TodoItem.tsx
git commit -m "feat: add TodoItem component"
```

---

### Task 5: `TodoView` 컴포넌트

**설계 결정 (구현 전 숙지):**
- `key={activeFilename}`이 AppShell에서 설정되므로, 파일 전환 시 컴포넌트가 완전히 remount됨. `useEffect`로 content 변경을 감지할 필요 없음.
- 직렬화는 이벤트 핸들러에서 즉시(eager) 수행하여 ref 패턴 불필요.
- `type`은 TodoView 내부에서 `'todos'`로 하드코딩 (이 컴포넌트는 todos 전용).
- 새 항목 추가 시 `setItems`가 비동기이므로, newItems 배열을 직접 구성해 저장.
- `onChange`에서 체크박스 변경 여부는 `updated.checked !== item.checked`로 비교 (이벤트 핸들러 클로저 내에서 `item`은 map 콜백의 현재 값으로 신선함).

**Files:**
- Create: `src/components/TodoView.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/TodoView.tsx`:

```tsx
'use client'
import { useState, useCallback } from 'react'
import { parseMarkdownToItems, serializeItemsToMarkdown, TodoItem as TodoItemType } from '@/lib/todos'
import { TodoItem } from './TodoItem'
import { useAutoSave } from '@/hooks/useAutoSave'

interface TodoViewProps {
  content: string
  filename: string
  onSave?: (filename: string) => void
}

export function TodoView({ content, filename, onSave }: TodoViewProps) {
  // key={activeFilename}으로 파일 전환 시 remount되므로 초기값만 사용
  const [items, setItems] = useState<TodoItemType[]>(() => parseMarkdownToItems(content))
  // 직렬화된 최신 content를 추적 (비-todo 라인 보존용)
  const [latestContent, setLatestContent] = useState(content)
  const [newTodoText, setNewTodoText] = useState('')

  const saveToServer = useCallback(
    async (markdown: string) => {
      await fetch(`/api/files/todos/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdown }),
      })
      onSave?.(filename)
    },
    [filename, onSave]
  )

  const triggerAutoSave = useAutoSave(saveToServer, 500)

  const applyChange = (newItems: TodoItemType[], immediate: boolean) => {
    // 직렬화를 이벤트 핸들러 내에서 즉시 수행 → 항상 최신 상태
    const markdown = serializeItemsToMarkdown(newItems, latestContent)
    setItems(newItems)
    setLatestContent(markdown)
    if (immediate) {
      saveToServer(markdown)
    } else {
      triggerAutoSave(markdown)
    }
  }

  const addTodo = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const newItem: TodoItemType = {
      id: crypto.randomUUID(),
      checked: false,
      text: trimmed,
      due: null,
      priority: null,
    }
    // newItems를 직접 구성해 저장 (setItems 비동기 문제 방지)
    const newItems = [...items, newItem]
    applyChange(newItems, true)
    setNewTodoText('')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <TodoItem
            key={item.id}
            item={item}
            onChange={(updated) => {
              const newItems = items.map((it) => (it.id === updated.id ? updated : it))
              // item은 map 콜백의 현재 변수 — 신선한 값으로 비교
              const immediate = updated.checked !== item.checked
              applyChange(newItems, immediate)
            }}
          />
        ))}
      </div>

      {/* 새 항목 추가 */}
      <div className="flex items-center gap-2 px-3 py-2 mt-2">
        <span className="text-gray-300 dark:text-gray-600 text-sm">+</span>
        <input
          type="text"
          placeholder="새 할 일 추가..."
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTodo(newTodoText) }}
          onBlur={() => addTodo(newTodoText)}
          className="flex-1 text-sm bg-transparent outline-none text-gray-500 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/TodoView.tsx
git commit -m "feat: add TodoView component"
```

---

## Chunk 3: AppShell 통합

> **전제:** Chunk 1의 `src/lib/todos.ts`가 완료되어 있어야 함. Chunk 2의 모든 컴포넌트가 완료되어 있어야 함.

### Task 6: `AppShell`에서 todos 타입에 `TodoView` 렌더링

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: AppShell 수정**

`src/components/AppShell.tsx`에서 `Editor` import 아래에 `TodoView` import 추가:

```tsx
import { TodoView } from './TodoView'
```

`<Editor .../>` 블록을 다음으로 교체:

```tsx
{type === 'todos' ? (
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
    onSave={refresh}
  />
)}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 빌드 성공 (에러 없음)

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
pnpm test
```

Expected: PASS (기존 테스트 + todos.test.ts 모두 통과)

- [ ] **Step 4: 커밋**

```bash
git add src/components/AppShell.tsx src/components/TodoView.tsx
git commit -m "feat: render TodoView for todos type in AppShell"
```

---

## 완료 기준

- [ ] `pnpm test` 전체 통과
- [ ] `pnpm build` 에러 없음
- [ ] todos 뷰: 체크박스 토글 시 즉시 `.md` 파일 수정 확인
- [ ] todos 뷰: due date picker (텍스트 + 달력 양방향 동기화) 동작 확인
- [ ] todos 뷰: priority 드롭다운 동작 확인
- [ ] todos 뷰: 새 항목 추가 동작 확인
- [ ] notes 뷰: 기존 Tiptap 에디터 변경 없음 확인
