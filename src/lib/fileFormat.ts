export function isPrivate(content: string): boolean {
  return content.startsWith('PRIVATE:')
}
