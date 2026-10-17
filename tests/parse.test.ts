import { describe, expect, it } from 'vitest'
import { parseCaption } from '../src/prefill/parse'

const opts = { tags: ['coffee', 'matcha', 'pastries', 'restaurant', 'brunch'], areas: ['Legazpi Village', 'Poblacion'] }

describe('parseCaption', () => {
  it('reads a pin line with name, address and area', () => {
    const r = parseCaption(
      'Best ceremonial usucha in Makati 🍵\n📍 Matcha Saru, G/F Grepalife Bldg, 221 Sen. Gil Puyat Ave, Salcedo Village\n#matcha #makaticafe',
      opts,
    )
    expect(r.name).toBe('Matcha Saru')
    expect(r.address).toBe('G/F Grepalife Bldg, 221 Sen. Gil Puyat Ave')
    expect(r.area).toBe('Salcedo Village')
    expect(r.tags).toEqual(['matcha'])
  })

  it('uses the area spelling already on file and ignores the city', () => {
    const r = parseCaption('new fave spot sa legaspi!! croissants + flat white 🥐☕️\n📍Kumo Coffee - Legaspi, Makati', opts)
    expect(r.name).toBe('Kumo Coffee')
    expect(r.area).toBe('Legazpi Village')
    expect(r.tags.sort()).toEqual(['coffee', 'pastries'])
    expect(r.address).toBeUndefined()
  })

  it('finds keywords inside hashtags', () => {
    const r = parseCaption('weekend vibes #icedmatchalatte #croissantlover #poblacionmakati #petfriendly', opts)
    expect(r.tags.sort()).toEqual(['matcha', 'pastries'])
    expect(r.petFriendly).toBe(true)
    expect(r.name).toBeUndefined()
  })

  it('picks up work flags and pets in Taglish', () => {
    const r = parseCaption('Super work friendly, may wifi at outlets everywhere. Dog friendly din! Location: Yardstick Coffee, Rockwell', opts)
    expect(r.work.sort()).toEqual(['laptop', 'outlets', 'wifi'])
    expect(r.petFriendly).toBe(true)
    expect(r.name).toBe('Yardstick Coffee')
    expect(r.area).toBe('Rockwell')
  })

  it('matches custom tags already in use', () => {
    const r = parseCaption('Sunday #brunch done right. Eggs benny 10/10', opts)
    expect(r.tags.sort()).toEqual(['brunch', 'restaurant'])
  })

  it('collects mentions except the poster', () => {
    const r = parseCaption('collab with @kumo.coffee and @makatieats ✨ thanks @foodie_mico', { ...opts, author: '@foodie_mico' })
    expect(r.mentions).toEqual(['kumo.coffee', 'makatieats'])
  })

  it('skips a pin that is only the area', () => {
    const r = parseCaption('cute cafe crawl 📍 Poblacion, Makati', opts)
    expect(r.name).toBeUndefined()
    expect(r.area).toBe('Poblacion')
  })

  it('returns nothing useful for an unrelated caption', () => {
    const r = parseCaption('Scramble up ur name & I’ll try to guess it😍❤️ #foryoupage #petsoftiktok', opts)
    expect(r).toEqual({ tags: [], work: [], petFriendly: false, mentions: [], area: undefined })
  })
})
