import { describe, expect, it } from 'vitest'
import { findArea, MAKATI_AREAS, nameFromHandle, parseCaption, profileName } from '../../src/prefill/parse'
import { DEFAULT_AREAS } from '../../src/types'
import { opts, UJISAN_CAPTION } from './fixtures'

/** Just the fields a case cares about, so `undefined` means "not set" (toMatchObject wants the key present). */
function only<T extends object>(got: T, want: object): Partial<T> {
  return Object.fromEntries(Object.keys(want).map((k) => [k, got[k as keyof T]])) as Partial<T>
}

describe('parseCaption', () => {
  it('reads the 📍 line for name, address and area', () => {
    const cases: [string, { name?: string; address?: string; area?: string }][] = [
      [
        'Best usucha in Makati 🍵\n📍 Matcha Saru, G/F Grepalife Bldg, 221 Sen. Gil Puyat Ave, Salcedo Village\n#matcha',
        { name: 'Matcha Saru', address: 'G/F Grepalife Bldg, 221 Sen. Gil Puyat Ave', area: 'Salcedo Village' },
      ],
      // The area takes the spelling on file; the city is dropped.
      ['croissants + flat white\n📍Kumo Coffee - Legaspi, Makati', { name: 'Kumo Coffee', address: undefined, area: 'Legazpi Village' }],
      ['new fave 📍 @kumo.coffee, Legazpi Village', { name: 'Kumo Coffee', area: 'Legazpi Village' }],
      ['Dog friendly din! Location: Yardstick Coffee, Rockwell', { name: 'Yardstick Coffee', area: 'Rockwell' }],
      // A pin that's only the area, or a whole sentence, isn't a name.
      ['cute cafe crawl 📍 Poblacion, Makati', { name: undefined, area: 'Poblacion' }],
      ['📍 this little place hidden behind the office towers that nobody ever talks about', { name: undefined }],
    ]
    for (const [caption, want] of cases) expect(only(parseCaption(caption, opts), want), caption).toEqual(want)
  })

  it('stops a pinned @account at the end of its sentence', () => {
    const want = {
      name: 'Ujisan Matcha',
      address: undefined,
      tags: ['matcha'],
      work: ['laptop'],
      mentions: [],
    }
    expect(only(parseCaption(UJISAN_CAPTION, { ...opts, author: '@notharaya' }), want)).toEqual(want)
  })

  it('reads tags, work and pet flags from words and hashtags', () => {
    const cases: [string, { tags: string[]; work?: string[]; petFriendly?: boolean }][] = [
      ['weekend vibes #icedmatchalatte #croissantlover #petfriendly', { tags: ['matcha', 'pastries'], petFriendly: true }],
      ['Super work friendly, may wifi at outlets everywhere', { tags: [], work: ['laptop', 'outlets', 'wifi'] }],
      ['Sunday #brunch done right. Eggs benny 10/10', { tags: ['brunch', 'restaurant'] }],
      ['Scramble up ur name & I’ll try to guess it😍❤️ #foryoupage', { tags: [], work: [], petFriendly: false }],
    ]
    for (const [caption, want] of cases) {
      const r = parseCaption(caption, opts)
      expect(only({ ...r, tags: r.tags.sort(), work: r.work.sort() }, want), caption).toEqual(want)
    }
  })

  it('lists other accounts as mentions, or names the place after a lone shop account', () => {
    expect(parseCaption('collab with @kumo.coffee and @makatieats ✨ thanks @foodie_mico', { ...opts, author: '@foodie_mico' }).mentions).toEqual([
      'kumo.coffee',
      'makatieats',
    ])
    expect(parseCaption('quiet spot for working @kumo.coffee ☕', opts)).toMatchObject({ name: 'Kumo Coffee', mentions: [] })
    expect(parseCaption('with @bestfriend at the new place', opts).name).toBeUndefined()
  })
})

describe('names from profiles', () => {
  it('cleans display names and handles into cafe names', () => {
    const cases: [string | undefined, string | undefined][] = [
      [profileName('Kumo Coffee PH ☕️'), 'Kumo Coffee'],
      [profileName('Yardstick | Taguig'), 'Yardstick'],
      [profileName('Habitual - Makati'), 'Habitual'],
      [profileName('Blue Bottle Coffee'), 'Blue Bottle Coffee'],
      [profileName('☕️'), undefined],
      [nameFromHandle('kumo.coffee'), 'Kumo Coffee'],
      [nameFromHandle('habitual_coffee_ph'), 'Habitual Coffee'],
    ]
    for (const [got, want] of cases) expect(got).toBe(want)
  })
})

describe('findArea', () => {
  it('uses the names people use, villages before roads', () => {
    const known = ['Chino Roces', 'Legazpi Village', 'Salcedo']
    const cases: [string, string[], string][] = [
      ['2129 Chino Roces Ave, Legaspi Village, Makati City', known, 'Legazpi Village'],
      ['Twenty-third, 2316 Chino Roces Ave', known, 'Chino Roces'],
      ['Pio del Pilar', known, 'Chino Roces'],
      ['Pasong Tamo', [], 'Chino Roces'],
      ['Salcedo Village', known, 'Salcedo'],
      ['lunch at Greenbelt 5', DEFAULT_AREAS, 'Ayala Center'],
      ['Jupiter St, Bel-Air', DEFAULT_AREAS, 'Jupiter / Bel-Air'],
      ['Circuit Makati', DEFAULT_AREAS, 'Circuit'],
    ]
    for (const [text, areas, want] of cases) expect(findArea(text, areas), text).toBe(want)
  })

  it('knows how to spell every preset area', () => {
    const named = MAKATI_AREAS.map(([name]) => name)
    for (const a of DEFAULT_AREAS) expect(named).toContain(a)
  })
})
