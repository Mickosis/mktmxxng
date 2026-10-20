import { describe, expect, it } from 'vitest'
import { cleanLink, handleOf, isProfile, sameLink } from '../../src/prefill/preview'
import { publicName, shortName } from '../../src/types'

describe('social links', () => {
  it('tells profiles from posts', () => {
    const cases: [string, boolean][] = [
      ['https://www.tiktok.com/@kumo.coffee', true],
      ['https://www.tiktok.com/@kumo.coffee/video/123', false],
      ['https://www.instagram.com/kumo.coffee/?igsh=abc', true],
      ['https://www.instagram.com/reel/Cxyz/', false],
      ['https://www.instagram.com/p/Cxyz/', false],
      ['https://www.facebook.com/kumocoffee', true],
      ['https://www.facebook.com/profile.php?id=100064627301814', true],
      ['https://www.facebook.com/reel/123', false],
      ['https://www.facebook.com/share/r/1AbC/', false],
      ['https://fb.watch/abc/', false],
    ]
    for (const [url, want] of cases) expect(isProfile(url), url).toBe(want)
  })

  it('reads the handle from a profile link', () => {
    expect(handleOf('https://www.instagram.com/kumo.coffee/')).toBe('kumo.coffee')
    expect(handleOf('https://www.tiktok.com/@kumo.coffee')).toBe('kumo.coffee')
    expect(handleOf('https://www.instagram.com/reel/Cxyz/')).toBeNull()
  })

  it('drops tracking but keeps what picks the page', () => {
    expect(cleanLink('https://www.facebook.com/profile.php?id=42&mibextid=xyz')).toBe('https://www.facebook.com/profile.php?id=42')
    expect(cleanLink('https://www.instagram.com/kumo.coffee/?igsh=abc')).toBe('https://www.instagram.com/kumo.coffee/')
    expect(sameLink('https://instagram.com/kumo.coffee', 'https://www.instagram.com/kumo.coffee/?igsh=abc')).toBe(true)
    expect(sameLink('https://www.facebook.com/profile.php?id=1', 'https://www.facebook.com/profile.php?id=2')).toBe(false)
  })
})

describe('public names', () => {
  it('cuts the last name to an initial until a name is chosen', () => {
    expect(shortName('Mico Rigunay')).toBe('Mico R.')
    expect(shortName('Mary Ann santos')).toBe('Mary Ann S.')
    expect(shortName('mico')).toBe('mico')
    expect(publicName('Mico Rigunay', true)).toBe('Mico Rigunay')
    expect(publicName('Mico Rigunay', false)).toBe('Mico R.')
  })
})
