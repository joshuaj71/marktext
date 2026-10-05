import { describe, expect, it } from 'vitest'
import { sideBarFileName } from '@/components/sideBar/displayName'

describe('sidebar file names', () => {
  it('lists names as they are by default', () => {
    expect(sideBarFileName('notes.md', false)).toBe('notes.md')
  })

  it('drops Markdown extensions when asked, in any case', () => {
    expect(sideBarFileName('notes.md', true)).toBe('notes')
    expect(sideBarFileName('README.MD', true)).toBe('README')
    expect(sideBarFileName('draft.markdown', true)).toBe('draft')
    expect(sideBarFileName('page.mdx', true)).toBe('page')
  })

  it('drops only the last extension', () => {
    expect(sideBarFileName('v1.2 notes.md', true)).toBe('v1.2 notes')
    expect(sideBarFileName('archive.md.md', true)).toBe('archive.md')
  })

  it('keeps other extensions, plain text included', () => {
    expect(sideBarFileName('notes.txt', true)).toBe('notes.txt')
    expect(sideBarFileName('image.png', true)).toBe('image.png')
    expect(sideBarFileName('Untitled-1', true)).toBe('Untitled-1')
  })

  it('keeps a name that is only the extension', () => {
    expect(sideBarFileName('.md', true)).toBe('.md')
  })
})
