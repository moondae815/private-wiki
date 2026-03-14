import { buildTagTree } from '@/lib/tagTree'
import { FileEntry } from '@/types'

function makeFile(filename: string, tags: string[]): FileEntry {
  return {
    filename,
    title: filename,
    type: 'notes',
    tags,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('buildTagTree', () => {
  it('places a file with a flat tag under the correct root node', () => {
    const file = makeFile('a.md', ['work'])
    const tree = buildTagTree([file])
    expect(tree.roots.get('work')?.files).toContain(file)
  })

  it('places a file with a deep tag only at the leaf node', () => {
    const file = makeFile('b.md', ['work/project/design'])
    const tree = buildTagTree([file])
    const workNode = tree.roots.get('work')!
    const projectNode = workNode.children.get('project')!
    const designNode = projectNode.children.get('design')!
    expect(designNode.files).toContain(file)
    expect(workNode.files).not.toContain(file)
    expect(projectNode.files).not.toContain(file)
  })

  it('places a file with multiple tags in all corresponding leaf nodes', () => {
    const file = makeFile('c.md', ['work', 'personal'])
    const tree = buildTagTree([file])
    expect(tree.roots.get('work')?.files).toContain(file)
    expect(tree.roots.get('personal')?.files).toContain(file)
  })

  it('places a file with no tags in untagged', () => {
    const file = makeFile('d.md', [])
    const tree = buildTagTree([file])
    expect(tree.untagged).toContain(file)
    expect(tree.roots.size).toBe(0)
  })

  it('handles trailing-slash tag by filtering empty segments', () => {
    // 'work/' splits to ['work', ''] — filter(Boolean) removes empty string
    const file = makeFile('e.md', ['work/'])
    const tree = buildTagTree([file])
    expect(tree.roots.get('work')?.files).toContain(file)
  })

  it('handles double-slash tag by filtering empty segments', () => {
    // simulate a tag that somehow has a double slash (edge case)
    const file = makeFile('f.md', ['work//project'])
    const tree = buildTagTree([file])
    const workNode = tree.roots.get('work')!
    const projectNode = workNode.children.get('project')!
    expect(projectNode.files).toContain(file)
  })

  it('sets correct fullPath on each node', () => {
    const file = makeFile('g.md', ['work/project'])
    const tree = buildTagTree([file])
    const workNode = tree.roots.get('work')!
    const projectNode = workNode.children.get('project')!
    expect(workNode.fullPath).toBe('work')
    expect(projectNode.fullPath).toBe('work/project')
  })
})
