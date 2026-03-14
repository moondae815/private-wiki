# Todo Due Date & Priority — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Todos 뷰에 커스텀 구조화 UI를 추가한다. `type === 'todos'`일 때 Tiptap 에디터 대신 `TodoView` 컴포넌트를 렌더링하며, 각 항목에 인라인 due date picker와 priority 드롭다운을 제공한다. 데이터는 기존 마크다운 파일(`data/todos/`)에 `@due:YYYY-MM-DD @priority:high|medium|low` 인라인 포맷으로 저장된다.

---

## Data Format

```
- [ ] 할 일 텍스트 @due:2025-03-20 @priority:high
- [x] 완료된 항목 @due:2025-03-15 @priority:low
- [ ] 메타데이터 없는 항목
- [ ]
```

- `@due:` / `@priority:` 어노테이션은 라인 끝에 위치
- 마크다운 파일의 나머지 줄(제목, 일반 텍스트 등)은 파싱/직렬화 시 보존

---

## Data Model

```ts
interface TodoItem {
  id: string                              // crypto.randomUUID() — 파싱 시 1회 생성, 파일에 쓰지 않음
  checked: boolean
  text: string                            // @due/@priority 제외한 순수 텍스트 (빈 문자열 허용)
  due: string | null                      // "YYYY-MM-DD" 형식
  priority: 'high' | 'medium' | 'low' | null
}
```

**ID 전략:** `id`는 `parseMarkdownToItems` 호출 시 `crypto.randomUUID()`로 생성한다. 파일에는 저장하지 않는다. 파일을 다시 fetch해서 재파싱하면 ID가 바뀌므로, `TodoView`는 파일 변경 후 재fetch 시 전체 items 상태를 교체한다 (기존 Editor와 동일한 패턴).

---

## Architecture

### 새 파일

| 파일 | 역할 |
|------|------|
| `src/lib/todos.ts` | 마크다운 ↔ TodoItem[] 파서/직렬라이저 |
| `src/components/TodoView.tsx` | 최상위 Todo 뷰 컴포넌트 |
| `src/components/TodoItem.tsx` | 개별 항목 (체크박스, 텍스트, 배지) |
| `src/components/DatePickerPopover.tsx` | 날짜 배지 + 팝오버 (텍스트 input + date input) |
| `src/components/PriorityDropdown.tsx` | 우선순위 배지 + 드롭다운 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/AppShell.tsx` | `type === 'todos'`이면 `<TodoView>` 렌더링, Notes는 기존 `<Editor>` 유지 |

---

## Component Hierarchy

```
AppShell (type='todos')
└── TodoView
    ├── TodoItem (×N)
    │   ├── Checkbox (즉시 저장)
    │   ├── InlineTextEdit (더블클릭 → input)
    │   ├── DatePickerPopover
    │   └── PriorityDropdown
    └── AddTodoInput (하단 입력창)
```

---

## Data Flow

**AppShell → TodoView props:**

```ts
interface TodoViewProps {
  content: string        // 마크다운 원문 (AppShell의 activeContent)
  filename: string
  onSave?: (filename: string) => void
}
```

`AppShell`은 기존과 동일하게 `activeContent`를 fetch해서 내려준다. `TodoView`는 이를 받아 `parseMarkdownToItems(content)`로 내부 상태를 초기화한다. `content` prop이 바뀌면 (다른 파일 선택 시) items 상태를 재초기화한다.

**저장 흐름:**
1. 사용자 인터랙션 → items 상태 업데이트
2. `serializeItemsToMarkdown(items, content)` → 마크다운 문자열 생성
3. `useAutoSave` (기존 훅 재사용) 또는 즉시 PUT → `/api/files/todos/{filename}`
4. 즉시 저장의 경우 `onSave?.(filename)` 콜백 호출 (사이드바 갱신)

`serializeItemsToMarkdown`의 두 번째 인자 `content`는 **현재 TodoView가 보유한 최신 content** (마지막으로 받은 prop 값)를 사용한다. 연속 저장 시에는 직전 직렬화 결과를 `content`로 사용하여 비-todo 라인 보존이 일관되게 유지된다.

---

## `src/lib/todos.ts`

```ts
// extractTodoMetadata는 markdown.ts에서 import하여 재사용
// 파싱 순서: 체크박스 prefix 제거 → 남은 텍스트에서 extractTodoMetadata 호출 → text 필드는 @annotation 제거 후 trim

parseMarkdownToItems(content: string): TodoItem[]
serializeItemsToMarkdown(items: TodoItem[], latestContent: string): string
```

**파싱 규칙:**
- `- [ ] ` 또는 `- [x] ` 패턴의 라인 → TodoItem으로 변환
- 텍스트가 없는 항목(`- [ ] `) → `text: ""`로 파싱, 직렬화 시 `- [ ] `로 복원
- 나머지 라인 (제목, 빈 줄 등) → 직렬화 시 원위치에 보존

**직렬화 규칙:**
- `latestContent`의 라인 배열에서 todo 라인을 순서대로 items의 직렬화 결과로 교체
- todo 항목 수가 늘었으면 마지막 todo 라인 뒤에 추가, 줄었으면 해당 라인 제거
- todo 라인 사이에 비-todo 라인이 끼어 있는 경우(예: 일반 불릿)도 원위치에 보존됨 (단위 테스트 필요)

---

## Save Strategy

| 이벤트 | 저장 방식 |
|--------|----------|
| 체크박스 토글 | 즉시 PUT (debounce 없음) |
| 텍스트/날짜/우선순위 변경 | `useAutoSave` 500ms debounce 후 PUT |
| 새 항목 추가 (Enter) | 즉시 PUT |
| 새 항목 입력창 blur — **텍스트가 있을 때만** 저장 | 즉시 PUT |
| 새 항목 입력창 blur — 텍스트 없음 | 무시 (저장 안 함) |

---

## UI Details

### TodoItem 레이아웃

```
[✓] 할 일 텍스트                        [2025-03-20] [high]
[□] 다른 할 일                          [+ 날짜]     [+ 우선순위]
```

- 텍스트 더블클릭 → 인라인 `<input>` 전환, Enter/blur로 확정
- 완료 항목: 텍스트에 취소선, 흐린 색상

### DatePickerPopover

- 날짜 있음: `2025-03-20` 배지 표시, overdue(오늘 이전)면 빨강
- 날짜 없음: `+ 날짜` 버튼
- 클릭 → 팝오버:
  - `<input type="text">` — 직접 타이핑 (YYYY-MM-DD)
  - `<input type="date">` — 달력 선택
  - 양방향 동기화: text 변경 시 파싱해서 date input 업데이트, date input 선택 시 YYYY-MM-DD 포맷으로 text 업데이트
  - "날짜 제거" 버튼
  - 팝오버 외부 클릭 시 닫힘

### PriorityDropdown

- 색상: `high`=빨강, `medium`=노랑, `low`=파랑, 없음=회색
- 클릭 → 드롭다운: `high` / `medium` / `low` / `없음` 4개 옵션

### AddTodoInput

- 리스트 하단 `+ 새 할 일` 입력창
- Enter 시 항목 추가 후 즉시 저장, 입력창 초기화
- blur 시 텍스트가 있으면 저장, 없으면 무시

---

## Known Limitations

- debounced 저장(500ms) 도중 파일을 전환하면 미저장 변경이 유실됨 — Editor와 동일한 동작

## Out of Scope

- Notes 타입의 변경 없음
- 항목 삭제 기능 없음
- 항목 드래그 앤 드롭 재정렬 없음
- 마감일 기준 정렬/필터링 없음 (사이드바 확장은 별도 작업)
