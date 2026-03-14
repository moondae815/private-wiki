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
    expect(items[0].text).toBe('작업')
    expect(items[0].due).toBe('2025-03-20')
    expect(items[0].priority).toBe('high')
  })

  it('텍스트 없는 항목(- [ ] , 후행 공백 포함)을 빈 text로 파싱한다', () => {
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
    const bulletIdx = lines.indexOf('- 일반 불릿')
    const first = lines.indexOf('- [ ] 첫번째')
    const second = lines.indexOf('- [ ] 두번째')
    expect(bulletIdx).toBe(first + 1)
    expect(second).toBe(bulletIdx + 1)
  })

  it('빈 text 항목을 "- [ ]"로 직렬화한다 (후행 공백 없음)', () => {
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
    expect(result).not.toMatch(/\n\n\n/)
    const lines = result.split('\n')
    const existingIdx = lines.indexOf('- [ ] 기존')
    expect(lines[existingIdx + 1]).toBe('- [ ] 새 항목')
  })

  it('모든 항목이 제거되면 todo 라인이 없는 content를 반환한다', () => {
    const content = '# 제목\n- [ ] 첫번째\n- [ ] 두번째\n'
    const items = parseMarkdownToItems(content)
    const result = serializeItemsToMarkdown([], content)
    expect(result).toContain('# 제목')
    expect(result).not.toContain('첫번째')
    expect(result).not.toContain('두번째')
  })

  it('parse → serialize → parse 라운드트립이 동일한 데이터를 반환한다', () => {
    const content = '# 제목\n\n- [ ] 작업 @due:2025-03-20 @priority:high\n- [x] 완료\n'
    const items1 = parseMarkdownToItems(content)
    const serialized = serializeItemsToMarkdown(items1, content)
    const items2 = parseMarkdownToItems(serialized)
    expect(items2).toHaveLength(items1.length)
    expect(items2[0].checked).toBe(items1[0].checked)
    expect(items2[0].text).toBe(items1[0].text)
    expect(items2[0].due).toBe(items1[0].due)
    expect(items2[0].priority).toBe(items1[0].priority)
    expect(items2[1].checked).toBe(items1[1].checked)
  })
})
