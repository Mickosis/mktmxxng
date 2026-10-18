import { describe, expect, it } from 'vitest'
import { nameFromHandle, parseCaption, profileName } from '../src/prefill/parse'
import { cleanLink, handleOf, isProfile, sameLink } from '../src/prefill/preview'
import { publicName, shortName } from '../src/types'
import { cleanMapsLink, isMapsLink, placeFromShareText, placeFromUrl, placePrefill } from '../src/prefill/maps'

const opts = { tags: ['coffee', 'matcha', 'pastries', 'restaurant', 'brunch'], areas: ['Legazpi Village', 'Poblacion'] }

describe('parseCaption', () => {
  it('takes the name from a pinned account and stops the pin at the sentence', () => {
    const r = parseCaption(
      "Sharing another introvert friendly-cafe in Makati where you can be productive! 📍@ujisan.matcha  I know how hard it is to find cafes that aren't overstimulating (and one where staying for a long time is ok) but I found one and the vibe is *chefs kiss* Lmk your thoughts if you decide to go 🙆🏻‍♀️ #introvertproblems",
      { ...opts, author: '@notharaya' },
    )
    expect(r.name).toBe('Ujisan Matcha')
    expect(r.tags).toEqual(['matcha'])
    expect(r.work).toEqual(['laptop'])
    expect(r.mentions).toEqual([])
    expect(r.address).toBeUndefined()
  })

  it('reads area after a pinned account', () => {
    const r = parseCaption('new fave 📍 @kumo.coffee, Legazpi Village', opts)
    expect(r).toMatchObject({ name: 'Kumo Coffee', area: 'Legazpi Village', mentions: [] })
  })

  it("doesn't take a long pinned sentence as the name", () => {
    const r = parseCaption('📍 this little place hidden behind the office towers that nobody ever talks about', opts)
    expect(r.name).toBeUndefined()
  })

  it('names the place after a single shop-like tag when there is no pin', () => {
    expect(parseCaption('quiet spot for working @kumo.coffee ☕', opts).name).toBe('Kumo Coffee')
    expect(parseCaption('with @bestfriend at the new place', opts).name).toBeUndefined()
  })

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

describe('profileName', () => {
  it('drops branches, country tags and emoji', () => {
    expect(profileName('Kumo Coffee PH ☕️')).toBe('Kumo Coffee')
    expect(profileName('Yardstick | Taguig')).toBe('Yardstick')
    expect(profileName('Blue Bottle Coffee')).toBe('Blue Bottle Coffee')
    expect(profileName('Habitual - Makati')).toBe('Habitual')
    expect(profileName('☕️')).toBeUndefined()
  })

  it('guesses a name from a handle', () => {
    expect(nameFromHandle('kumo.coffee')).toBe('Kumo Coffee')
    expect(nameFromHandle('habitual_coffee_ph')).toBe('Habitual Coffee')
    expect(handleOf('https://www.instagram.com/kumo.coffee/')).toBe('kumo.coffee')
    expect(handleOf('https://www.tiktok.com/@kumo.coffee')).toBe('kumo.coffee')
    expect(handleOf('https://www.instagram.com/reel/Cxyz/')).toBeNull()
  })
})

describe('profile links', () => {
  it('tells profiles from posts', () => {
    expect(isProfile('https://www.tiktok.com/@kumo.coffee')).toBe(true)
    expect(isProfile('https://www.tiktok.com/@kumo.coffee/video/123')).toBe(false)
    expect(isProfile('https://www.instagram.com/kumo.coffee/?igsh=abc')).toBe(true)
    expect(isProfile('https://www.instagram.com/reel/Cxyz/')).toBe(false)
    expect(isProfile('https://www.instagram.com/p/Cxyz/')).toBe(false)
    expect(isProfile('https://www.facebook.com/kumocoffee')).toBe(true)
    expect(isProfile('https://www.facebook.com/profile.php?id=100064627301814')).toBe(true)
    expect(isProfile('https://www.facebook.com/reel/123')).toBe(false)
    expect(isProfile('https://www.facebook.com/share/r/1AbC/')).toBe(false)
    expect(isProfile('https://fb.watch/abc/')).toBe(false)
  })

  it('keeps the profile.php id but drops tracking', () => {
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

describe('maps links', () => {
  it('recognises Google and Apple Maps links', () => {
    expect(isMapsLink('https://maps.app.goo.gl/aQ3QfvDTvNdZ2gWo8?g_st=ic')).toBe(true)
    expect(isMapsLink('https://www.google.com/maps/place/Kumo+Coffee/@14.55,121.01,17z')).toBe(true)
    expect(isMapsLink('https://www.google.com.ph/maps/place/Kumo')).toBe(true)
    expect(isMapsLink('https://maps.apple.com/?q=Kumo&ll=14.5,121.0')).toBe(true)
    expect(isMapsLink('https://www.google.com/search?q=kumo')).toBe(false)
    expect(isMapsLink('https://www.tiktok.com/@kumo')).toBe(false)
  })

  it('drops tracking params but keeps the place', () => {
    expect(cleanMapsLink('https://maps.app.goo.gl/aQ3QfvDTvNdZ2gWo8?g_st=ic')).toBe('https://maps.app.goo.gl/aQ3QfvDTvNdZ2gWo8')
    expect(cleanMapsLink('https://www.google.com/maps/place/Kumo/@1,2,17z/data=!3d1!4d2?entry=ttu&g_ep=abc')).toBe('https://www.google.com/maps/place/Kumo/@1,2,17z/data=!3d1!4d2')
    expect(cleanMapsLink('https://maps.google.com/?q=Kumo&ftid=0x1&utm_source=x')).toBe('https://maps.google.com/?q=Kumo&ftid=0x1')
  })

  it('reads name and address from the URL', () => {
    expect(placeFromUrl('https://www.google.com/maps/place/Toby%27s+Estate+Salcedo/@14.56,121.02,17z/data=!3d14.5!4d121.0')).toEqual({ name: "Toby's Estate Salcedo", address: undefined })
    expect(placeFromUrl('https://maps.google.com/?q=Kumo+Coffee,+123+Herrera+St,+Legazpi+Village,+Makati,+1229+Metro+Manila,+Philippines&ftid=0x1')).toEqual({ name: 'Kumo Coffee', address: '123 Herrera St, Legazpi Village' })
    expect(placeFromUrl('https://maps.apple.com/?address=5365+General+Luna+St,+Makati,+Philippines&ll=14.56,121.03&q=Kumo')).toEqual({ name: 'Kumo', address: '5365 General Luna St' })
    expect(placeFromUrl('https://www.google.com/maps/search/?api=1&query=14.55,121.02')).toEqual({})
  })

  it('fills area and street from the pin when the URL has only a name', () => {
    const p = placePrefill(
      'https://maps.app.goo.gl/x',
      { url: 'https://www.google.com/maps/place/Kumo+Coffee/@14.5547,121.0177,17z', lat: 14.5547, lng: 121.0177, street: 'Rada Street', area: 'Legazpi Village', city: 'Makati' },
      opts,
    )
    expect(p).toMatchObject({ name: 'Kumo Coffee', address: 'Rada Street', area: 'Legazpi Village', tags: ['coffee'] })
    // Without the helper, the URL alone still gives the name.
    expect(placePrefill('https://www.google.com/maps/place/Matcha+Saru/@1,2,17z', null, opts)).toMatchObject({ name: 'Matcha Saru', tags: ['matcha'] })
  })

  it('uses the address shared with the link, and OSM areas when there is none', () => {
    const place = {
      url: 'https://www.google.com/maps/place/Ujisan+-+Makati/@14.5582666,121.0104817,17z/data=!3d14.5582666!4d121.0130566',
      lat: 14.5582666,
      lng: 121.0130566,
      street: 'Dela Rosa Street',
      area: 'Pio del Pilar',
      areas: ['Kayamanan A', 'Pio del Pilar'],
      city: 'Makati',
    }
    const link = 'https://maps.app.goo.gl/Mv3GQ3rAtDvW4UWv8'
    const text = `Ujisan - Makati\nBldg 2, King's Court, 2129 Chino Roces Ave, Legaspi Village, Makati City, 1229 Metro Manila\n${link}`
    expect(placeFromShareText(text, link)).toEqual({ name: 'Ujisan - Makati', address: "Bldg 2, King's Court, 2129 Chino Roces Ave, Legaspi Village, Makati City, 1229 Metro Manila" })
    expect(placeFromShareText(`Ujisan - Makati · Bldg 2, King's Court, 2129 Chino Roces Ave ${link}`, link)).toEqual({ name: 'Ujisan - Makati', address: "Bldg 2, King's Court, 2129 Chino Roces Ave" })
    expect(placeFromShareText(link, link)).toEqual({})
    expect(placePrefill(link, place, opts, placeFromShareText(text, link))).toMatchObject({
      name: 'Ujisan - Makati',
      address: "Bldg 2, King's Court, 2129 Chino Roces Ave",
      area: 'Legazpi Village',
    })
    // Link alone: the barangay beats the tiny subdivision.
    expect(placePrefill(link, place, opts)).toMatchObject({ address: 'Dela Rosa Street', area: 'Pio del Pilar' })
  })
})
