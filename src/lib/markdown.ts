export function extractTags(content: string): string[] {
  const allMatches = content.matchAll(/#([a-zA-Z가-힣0-9_-]+)/g)
  const tags: string[] = []
  for (const match of allMatches) {
    const index = match.index ?? 0
    const charBefore = content[index - 1]
    // Skip if at start of line (heading) - charBefore is newline or undefined
    if (charBefore === '\n' || charBefore === undefined) continue
    tags.push(match[1])
  }
  return [...new Set(tags)]
}

export interface TodoMetadata {
  due: string | null
  priority: 'high' | 'medium' | 'low' | null
}

export function extractTodoMetadata(itemText: string): TodoMetadata {
  const dueMatch = itemText.match(/@due:(\d{4}-\d{2}-\d{2})/)
  const priorityMatch = itemText.match(/@priority:(high|medium|low)/)
  return {
    due: dueMatch ? dueMatch[1] : null,
    priority: priorityMatch ? (priorityMatch[1] as TodoMetadata['priority']) : null,
  }
}
