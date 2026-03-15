# @ 자동완성 (AtMention Autocomplete) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo 입력창에서 `@` 타이핑 시 `@due:{오늘}` / `@priority:*` 자동완성 드롭다운을 제공하는 `AtMentionInput` 컴포넌트를 만들고, `TodoView`와 `TodoItem`에 통합한다.

**Architecture:** `AtMentionInput` 컴포넌트가 자동완성 로직과 드롭다운 렌더링을 캡슐화한다. `value` / cursor 상태로부터 필터된 제안을 파생(derive)하고, `dismissed` 상태로 Escape 닫기를 구현한다. `TodoView`와 `TodoItem`은 기존 `<input>`을 `<AtMentionInput>`으로 교체하며 `onChange`를 `string` 직접 수신 방식으로 변경한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Jest + @testing-library/react (jsdom)

---

## Chunk 1: AtMentionInput 컴포넌트 + 테스트

### Task 1: AtMentionInput 컴포넌트 생성

**Files:**
- Create: `src/components/AtMentionInput.tsx`

- [ ] **Step 1: 파일 생성**

`src/components/AtMentionInput.tsx` 를 아래 내용으로 생성한다:

```tsx
'use client'
import { useRef, useEffect, useState, useMemo } from 'react'

interface Suggestion {
  label: string
  hint: string | null
}

function getSuggestions(): Suggestion[] {
  const today = new Date().toISOString().slice(0, 10)
  return [
    { label: `@due:${today}`, hint: '오늘' },
    { label: '@priority:high', hint: null },
    { label: '@priority:medium', hint: null },
    { label: '@priority:low', hint: null },
  ]
}

export interface AtMentionInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function AtMentionInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className,
  autoFocus,
}: AtMentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cursor, setCursor] = useState(value.length)
  const [dismissed, setDismissed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const filtered = useMemo(() => {
    if (dismissed) return null
    const atIndex = value.lastIndexOf('@', cursor - 1)
    if (atIndex === -1) return null
    const tokenPart = value.slice(atIndex, cursor)
    if (/\s/.test(tokenPart)) return null
    const query = tokenPart.slice(1).toLowerCase()
    const matches = getSuggestions().filter((s) =>
      s.label.slice(1).toLowerCase().startsWith(query)
    )
    return matches.length > 0 ? { atIndex, matches } : null
  }, [value, cursor, dismissed])

  // query token이 바뀔 때마다 activeIndex 초기화 (count만 보면 같은 수의 다른 결과로 바뀔 때 놓침)
  const queryToken = filtered ? value.slice(filtered.atIndex, cursor) : null
  useEffect(() => {
    setActiveIndex(0)
  }, [queryToken])

  const insertSuggestion = (label: string) => {
    const newValue =
      value.slice(0, filtered!.atIndex) + label + ' ' + value.slice(cursor)
    setDismissed(true)
    onChange(newValue)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = e.target.selectionStart ?? e.target.value.length
    setCursor(pos)
    setDismissed(false)
    onChange(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(
          (i) => (i - 1 + filtered.matches.length) % filtered.matches.length
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertSuggestion(filtered.matches[activeIndex].label)
        return
      }
      if (e.key === 'Escape') {
        setDismissed(true)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
      />
      {filtered && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[240px] whitespace-nowrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-lg overflow-hidden">
          {filtered.matches.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center px-3 py-1.5 text-sm cursor-pointer ${
                i === activeIndex
                  ? 'bg-blue-100 dark:bg-blue-800/40'
                  : 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                insertSuggestion(s.label)
              }}
            >
              <span>{s.label}</span>
              {s.hint && (
                <span className="text-xs text-gray-400 ml-2">{s.hint}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 타입스크립트 확인**

```bash
pnpm tsc --noEmit
```

Expected: 오류 없음 (또는 기존 오류만 존재)

---

### Task 2: AtMentionInput 테스트 작성 및 통과

**Files:**
- Create: `__tests__/components/AtMentionInput.test.tsx`

- [ ] **Step 1: 테스트 파일 생성 (실패 확인용)**

`__tests__/components/AtMentionInput.test.tsx` 를 아래 내용으로 생성한다:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AtMentionInput } from '@/components/AtMentionInput'

function setup(value = '', onChange = jest.fn()) {
  const utils = render(
    <AtMentionInput
      value={value}
      onChange={onChange}
      placeholder="입력"
    />
  )
  const input = screen.getByPlaceholderText('입력')
  return { input, onChange, ...utils }
}

describe('AtMentionInput – 기본 렌더링', () => {
  it('input을 렌더링한다', () => {
    setup()
    expect(screen.getByPlaceholderText('입력')).toBeInTheDocument()
  })

  it('@가 없으면 드롭다운이 보이지 않는다', () => {
    setup('hello')
    expect(screen.queryByText('@due:', { exact: false })).not.toBeInTheDocument()
  })
})

describe('AtMentionInput – 드롭다운 표시', () => {
  it('@만 입력하면 4개 항목이 모두 표시된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    setup('@')
    expect(screen.getByText(`@due:${today}`)).toBeInTheDocument()
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
    expect(screen.getByText('@priority:medium')).toBeInTheDocument()
    expect(screen.getByText('@priority:low')).toBeInTheDocument()
  })

  it('@d 입력 시 @due만 표시된다', () => {
    setup('@d')
    expect(screen.getByText(/@due:/, )).toBeInTheDocument()
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
  })

  it('@p 입력 시 @priority 3개만 표시된다', () => {
    setup('@p')
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
    expect(screen.getByText('@priority:medium')).toBeInTheDocument()
    expect(screen.getByText('@priority:low')).toBeInTheDocument()
    expect(screen.queryByText(/@due:/)).not.toBeInTheDocument()
  })

  it('일치 항목 없으면 드롭다운이 숨겨진다', () => {
    setup('@xyz')
    expect(screen.queryByText(/@due:/)).not.toBeInTheDocument()
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
  })

  it('@due 오른쪽에 "오늘" 힌트가 표시된다', () => {
    setup('@')
    expect(screen.getByText('오늘')).toBeInTheDocument()
  })
})

describe('AtMentionInput – 제안 삽입', () => {
  it('항목 클릭 시 onChange가 삽입된 값으로 호출된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const onChange = jest.fn()
    render(<AtMentionInput value="할일 @d" onChange={onChange} placeholder="입력" />)
    const option = screen.getByText(`@due:${today}`)
    fireEvent.mouseDown(option)
    expect(onChange).toHaveBeenCalledWith(`할일 @due:${today} `)
  })

  it('항목 삽입 후 드롭다운이 닫힌다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const { rerender } = render(
      <AtMentionInput value="@d" onChange={jest.fn()} placeholder="입력" />
    )
    const option = screen.getByText(`@due:${today}`)
    fireEvent.mouseDown(option)
    // After insert, dismissed=true; rerender with new value to confirm closed
    rerender(
      <AtMentionInput value={`@due:${today} `} onChange={jest.fn()} placeholder="입력" />
    )
    expect(screen.queryByText(`@due:${today}`)).not.toBeInTheDocument()
  })
})

describe('AtMentionInput – 키보드 인터랙션', () => {
  it('Enter 키로 첫 번째 항목이 삽입된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const onChange = jest.fn()
    render(<AtMentionInput value="@d" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(`@due:${today} `)
  })

  it('Tab 키로 첫 번째 항목이 삽입된다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const onChange = jest.fn()
    render(<AtMentionInput value="@d" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onChange).toHaveBeenCalledWith(`@due:${today} `)
  })

  it('ArrowDown 후 Enter 시 두 번째 항목이 삽입된다', () => {
    const onChange = jest.fn()
    render(<AtMentionInput value="@p" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('@priority:medium ')
  })

  it('Escape 키로 드롭다운이 닫힌다', () => {
    const { rerender } = render(
      <AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />
    )
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Escape' })
    rerender(<AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />)
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
  })

  it('드롭다운 열린 상태에서 Enter는 부모 onKeyDown을 호출하지 않는다', () => {
    const onKeyDown = jest.fn()
    render(
      <AtMentionInput value="@p" onChange={jest.fn()} onKeyDown={onKeyDown} placeholder="입력" />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Enter' })
    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it('드롭다운 닫힌 상태에서 Enter는 부모 onKeyDown을 호출한다', () => {
    const onKeyDown = jest.fn()
    render(
      <AtMentionInput value="hello" onChange={jest.fn()} onKeyDown={onKeyDown} placeholder="입력" />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
  })
})

describe('AtMentionInput – ArrowUp 내비게이션', () => {
  it('ArrowUp으로 마지막 항목으로 순환된다', () => {
    const onChange = jest.fn()
    render(<AtMentionInput value="@p" onChange={onChange} placeholder="입력" />)
    const input = screen.getByPlaceholderText('입력')
    // activeIndex starts at 0; ArrowUp wraps to last (index 2 = @priority:low)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('@priority:low ')
  })
})

describe('AtMentionInput – onBlur 전달', () => {
  it('포커스 이탈 시 onBlur prop이 호출된다', () => {
    const onBlur = jest.fn()
    render(
      <AtMentionInput value="hello" onChange={jest.fn()} onBlur={onBlur} placeholder="입력" />
    )
    fireEvent.blur(screen.getByPlaceholderText('입력'))
    expect(onBlur).toHaveBeenCalled()
  })
})

describe('AtMentionInput – 중간 위치 @ 트리거', () => {
  it('문자열 중간의 @도 드롭다운을 표시한다', () => {
    // jsdom에서 selectionStart는 null → cursor = value.length = 8
    // value.lastIndexOf('@', 7) → 6 → tokenPart = "@p" → query = "p"
    setup('hello @p')
    expect(screen.getByText('@priority:high')).toBeInTheDocument()
  })
})

describe('AtMentionInput – onChange 동작', () => {
  it('onChange는 string을 직접 받는다', () => {
    const onChange = jest.fn()
    const { input } = setup('', onChange)
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('value 변경 시 dismissed가 초기화되어 드롭다운이 다시 열린다', () => {
    const today = new Date().toISOString().slice(0, 10)
    const { rerender } = render(
      <AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('입력'), { key: 'Escape' })
    rerender(<AtMentionInput value="@p" onChange={jest.fn()} placeholder="입력" />)
    expect(screen.queryByText('@priority:high')).not.toBeInTheDocument()
    // Simulate new typing (onChange triggers handleChange which resets dismissed)
    fireEvent.change(screen.getByPlaceholderText('입력'), { target: { value: '@' } })
    rerender(<AtMentionInput value="@" onChange={jest.fn()} placeholder="입력" />)
    expect(screen.getByText(`@due:${today}`)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
pnpm test -- __tests__/components/AtMentionInput.test.tsx
```

Expected: FAIL — 컴포넌트가 없으므로 import 오류

- [ ] **Step 3: Task 1의 컴포넌트 파일이 이미 생성됐으므로 테스트 재실행**

```bash
pnpm test -- __tests__/components/AtMentionInput.test.tsx
```

Expected: 모든 테스트 PASS

> 만약 실패하는 테스트가 있으면 컴포넌트 로직을 수정하여 통과시킨다.

- [ ] **Step 4: Commit**

```bash
git add src/components/AtMentionInput.tsx __tests__/components/AtMentionInput.test.tsx
git commit -m "feat: add AtMentionInput component with @ autocomplete dropdown"
```

---

## Chunk 2: TodoView / TodoItem 통합

### Task 3: TodoView 통합

**Files:**
- Modify: `src/components/TodoView.tsx`

- [ ] **Step 1: TodoView.tsx 수정**

`src/components/TodoView.tsx` 에서 `AtMentionInput` 을 import하고 "새 할 일" `<input>` 을 교체한다.

변경 전 (`import` 라인 추가):
```tsx
import { AtMentionInput } from './AtMentionInput'
```

변경 전 (input 부분):
```tsx
<input
  type="text"
  placeholder="새 할 일 추가..."
  value={newTodoText}
  onChange={(e) => setNewTodoText(e.target.value)}
  onKeyDown={(e) => { if (e.key === 'Enter') addTodo(newTodoText) }}
  onBlur={() => addTodo(newTodoText)}
  className="flex-1 text-sm bg-transparent outline-none text-gray-500 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600"
/>
```

변경 후:
```tsx
<AtMentionInput
  placeholder="새 할 일 추가..."
  value={newTodoText}
  onChange={setNewTodoText}
  onKeyDown={(e) => { if (e.key === 'Enter') addTodo(newTodoText) }}
  onBlur={() => addTodo(newTodoText)}
  className="flex-1 text-sm bg-transparent outline-none text-gray-500 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600"
/>
```

- [ ] **Step 2: 타입스크립트 확인**

```bash
pnpm tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 기존 테스트 전체 통과 확인**

```bash
pnpm test
```

Expected: 모든 테스트 PASS

---

### Task 4: TodoItem 통합

**Files:**
- Modify: `src/components/TodoItem.tsx`

- [ ] **Step 1: TodoItem.tsx 수정**

`src/components/TodoItem.tsx` 에서 `AtMentionInput` import 추가:
```tsx
import { AtMentionInput } from './AtMentionInput'
```

변경 전 (편집 input 부분):
```tsx
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
```

변경 후:
```tsx
<AtMentionInput
  autoFocus
  value={editText}
  onChange={setEditText}
  onBlur={commitText}
  onKeyDown={(e) => {
    if (e.key === 'Enter') commitText()
    if (e.key === 'Escape') { setEditing(false); setEditText(item.text) }
  }}
  className="w-full text-sm bg-transparent border-b border-blue-400 outline-none text-gray-800 dark:text-gray-200"
/>
```

- [ ] **Step 2: 타입스크립트 확인**

```bash
pnpm tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
pnpm test
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoView.tsx src/components/TodoItem.tsx
git commit -m "feat: integrate AtMentionInput into TodoView and TodoItem"
```

---

## 완료 기준

- [ ] `pnpm test` 전체 통과
- [ ] `pnpm tsc --noEmit` 오류 없음
- [ ] `pnpm build` 성공
- [ ] 브라우저에서 수동 검증:
  - `/todos` 페이지의 "새 할 일 추가..." 입력창에서 `@` 타이핑 시 드롭다운 표시
  - 항목 클릭/Enter/Tab 으로 자동완성 삽입 동작 확인
  - 기존 할 일 더블클릭 편집 시 동일하게 동작 확인
  - 다크모드에서 스타일 확인
