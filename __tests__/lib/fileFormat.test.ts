import { isPrivate } from '@/lib/fileFormat'

describe('isPrivate', () => {
  it('returns true for PRIVATE: prefix', () => {
    expect(isPrivate('PRIVATE:abc:def:ghi')).toBe(true)
  })

  it('returns false for plain markdown', () => {
    expect(isPrivate('# Hello\n\nworld')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isPrivate('')).toBe(false)
  })

  it('returns false if PRIVATE: is not at the very start', () => {
    expect(isPrivate('\nPRIVATE:abc')).toBe(false)
  })
})
