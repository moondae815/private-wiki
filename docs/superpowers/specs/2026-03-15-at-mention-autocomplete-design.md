# @ 자동완성 UX 디자인 스펙

**날짜:** 2026-03-15
**상태:** 승인됨

## 개요

Todo 입력창에서 `@` 를 타이핑하면 `@due:{오늘날짜}`, `@priority:high|medium|low` 자동완성 드롭다운을 표시하여, 메타데이터를 직접 타이핑하지 않고 선택할 수 있도록 UX를 개선한다.

## 영향 범위

- `TodoView` — "새 할 일 추가..." 입력창
- `TodoItem` — 더블클릭 인라인 편집 입력창

## 컴포넌트 구조

### 새 파일: `src/components/AtMentionInput.tsx`

`<input>` 을 감싸는 wrapper 컴포넌트. 자동완성 로직과 드롭다운 렌더링을 캡슐화한다.

**Props:**
```ts
interface AtMentionInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}
```

> `onChange`는 `string`을 직접 받도록 단순화 (기존 `e.target.value` 패턴 대신).

### 기존 파일 변경

| 파일 | 변경 내용 |
|------|----------|
| `TodoView.tsx` | "새 할 일" `<input>` → `<AtMentionInput>` |
| `TodoItem.tsx` | 편집 `<input>` → `<AtMentionInput>` |

## 자동완성 동작

### 트리거

입력값 내 어느 위치든 `@` 타이핑 시 드롭다운 표시.

### 드롭다운 항목 (총 4개)

```
@due:YYYY-MM-DD     ← 오늘 날짜 동적 삽입 (힌트: "오늘")
@priority:high
@priority:medium
@priority:low
```

### 필터링

`@` 이후 입력된 문자로 항목을 좁힘.
- `@d` → `@due:...` 만 표시
- `@p` → `@priority:*` 3개만 표시
- 일치 항목 없으면 드롭다운 숨김

### 삽입 동작

`@` 부터 현재 커서까지의 입력을 선택한 항목으로 교체 후 공백 추가.

예:
- `할 일 @d` + `@due:2026-03-15` 선택 → `할 일 @due:2026-03-15 `

### 키보드 인터랙션

| 키 | 동작 |
|----|------|
| `↑` / `↓` | 항목 이동 |
| `Enter` / `Tab` | 현재 항목 선택 |
| `Escape` | 드롭다운 닫기 |
| 그 외 | 계속 입력 (필터링 갱신) |

### 마우스 인터랙션

항목 클릭 시 선택. `onMouseDown` 사용으로 `onBlur` 보다 먼저 처리.

## 드롭다운 스타일

**위치:** 입력창 바로 아래, `position: absolute`. 부모 래퍼에 `position: relative`.

**Tailwind 클래스 (다크모드 지원):**

```
컨테이너: absolute top-full left-0 z-50 mt-1 min-w-[240px] whitespace-nowrap
           bg-white dark:bg-gray-800
           border border-gray-200 dark:border-gray-700
           shadow-md rounded-lg overflow-hidden

각 항목:  px-3 py-1.5 text-sm cursor-pointer
          hover:bg-blue-50 dark:hover:bg-blue-900/30

선택 항목: bg-blue-100 dark:bg-blue-800/40

힌트 텍스트: text-xs text-gray-400 ml-2
```

## 구현 노트

- **커서 위치:** `inputRef.current.selectionStart` 를 `onChange`/`onKeyDown` 이벤트에서 동기적으로 읽어야 한다. 비동기 접근 시 선택 영역이 사라질 수 있다.
- **`@` 위치 추적:** `value.lastIndexOf('@', cursorPosition)` 으로 커서 앞 가장 가까운 `@` 검색.
- **교체 범위:** `[atIndex, cursorPosition]` — 커서 위치까지만 교체. 커서 이후 텍스트는 보존.
- **오늘 날짜:** `new Date().toISOString().slice(0, 10)` (렌더 시마다 갱신).
- **`Enter` / `Tab` 키 충돌 방지:** 드롭다운 열려 있을 때 `Enter`/`Tab` 선택 시 반드시 `e.preventDefault()` 호출하여 부모의 submit 핸들러 및 포커스 이동 억제.
- **`onBlur` 동작:** 드롭다운 항목 클릭은 `onMouseDown` + `e.preventDefault()` 로 blur 억제. 일반 포커스 이탈 시에만 `onBlur` prop 호출.
- **드롭다운 상태 동기화:** `value` prop 이 외부에서 변경될 때(예: 제출 후 `""` 리셋) 드롭다운을 닫아야 한다. `@` 트리거 조건이 충족되지 않으면 드롭다운을 표시하지 않는다.
- **`autoFocus`:** HTML attribute 로 전달하지 않고 `useEffect` + `ref.current.focus()` 로 구현. TodoItem 더블클릭 편집 시 신뢰성 있는 포커스 보장.
- **드롭다운 너비:** 가장 긴 항목(`@due:2026-03-15 오늘`)을 수용하기 위해 `min-w-[240px]` + `whitespace-nowrap` 적용.
