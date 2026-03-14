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

export function serializeItemsToMarkdown(
  items: TodoItem[],
  latestContent: string
): string {
  const lines = latestContent.split('\n')

  const todoIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^- \[([ x])\] /.test(lines[i]) || lines[i] === '- [ ] ' || lines[i] === '- [x] ' || lines[i] === '- [ ]' || lines[i] === '- [x]') {
      todoIndices.push(i)
    }
  }

  const serialized = items.map(serializeItem)

  if (todoIndices.length === 0) {
    return latestContent.trimEnd() + '\n' + serialized.join('\n') + '\n'
  }

  const result = [...lines]

  if (serialized.length <= todoIndices.length) {
    for (let i = 0; i < serialized.length; i++) {
      result[todoIndices[i]] = serialized[i]
    }
    for (const idx of [...todoIndices.slice(serialized.length)].reverse()) {
      result.splice(idx, 1)
    }
  } else {
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
