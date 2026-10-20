import { describe, expect, it } from 'vitest'
import { cleanMapsLink, isMapsLink, placeFromShareText, placeFromUrl, placeIdOf, placePrefill } from '../../src/prefill/maps'
import { opts, UJISAN_ADDRESS, UJISAN_PLACE, UJISAN_SHORT } from './fixtures'

describe('Maps links', () => {
  it('recognises Google and Apple Maps links', () => {
    const cases: [string, boolean][] = [
      ['https://maps.app.goo.gl/aQ3QfvDTvNdZ2gWo8?g_st=ic', true],
      ['https://www.google.com/maps/place/Kumo+Coffee/@14.55,121.01,17z', true],
      ['https://www.google.com.ph/maps/place/Kumo', true],
      ['https://maps.apple.com/?q=Kumo&ll=14.5,121.0', true],
      ['https://www.google.com/search?q=kumo', false],
      ['https://www.tiktok.com/@kumo', false],
    ]
    for (const [url, want] of cases) expect(isMapsLink(url), url).toBe(want)
  })

  it('drops tracking params but keeps the place', () => {
    const cases: [string, string][] = [
      ['https://maps.app.goo.gl/aQ3QfvDTvNdZ2gWo8?g_st=ic', 'https://maps.app.goo.gl/aQ3QfvDTvNdZ2gWo8'],
      ['https://www.google.com/maps/place/Kumo/@1,2,17z/data=!3d1!4d2?entry=ttu&g_ep=abc', 'https://www.google.com/maps/place/Kumo/@1,2,17z/data=!3d1!4d2'],
      ['https://maps.google.com/?q=Kumo&ftid=0x1&utm_source=x', 'https://maps.google.com/?q=Kumo&ftid=0x1'],
    ]
    for (const [url, want] of cases) expect(cleanMapsLink(url)).toBe(want)
  })

  it('finds the same place behind different share links', () => {
    const id = '0x3397c953f558e119:0x9503bbb072307c6d'
    expect(placeIdOf(UJISAN_PLACE.url)).toBe(id)
    expect(placeIdOf(cleanMapsLink(UJISAN_PLACE.url))).toBe(id)
    expect(placeIdOf('https://maps.google.com/?q=Kumo&ftid=0x1a:0x2b')).toBe('0x1a:0x2b')
    expect(placeIdOf(UJISAN_SHORT)).toBeNull()
  })
})

describe('Maps pre-fill', () => {
  it('reads name and address from the URL', () => {
    const cases: [string, ReturnType<typeof placeFromUrl>][] = [
      ['https://www.google.com/maps/place/Toby%27s+Estate+Salcedo/@14.56,121.02,17z', { name: "Toby's Estate Salcedo", address: undefined }],
      [
        'https://maps.google.com/?q=Kumo+Coffee,+123+Herrera+St,+Legazpi+Village,+Makati,+1229+Metro+Manila,+Philippines',
        { name: 'Kumo Coffee', address: '123 Herrera St, Legazpi Village' },
      ],
      ['https://maps.apple.com/?address=5365+General+Luna+St,+Makati,+Philippines&q=Kumo', { name: 'Kumo', address: '5365 General Luna St' }],
      ['https://www.google.com/maps/search/?api=1&query=14.55,121.02', {}],
    ]
    for (const [url, want] of cases) expect(placeFromUrl(url), url).toEqual(want)
  })

  it('reads name and address from text shared with the link', () => {
    expect(placeFromShareText(`Ujisan - Makati\n${UJISAN_ADDRESS}\n${UJISAN_SHORT}`, UJISAN_SHORT)).toEqual({ name: 'Ujisan - Makati', address: UJISAN_ADDRESS })
    expect(placeFromShareText(`Ujisan - Makati · 2129 Chino Roces Ave ${UJISAN_SHORT}`, UJISAN_SHORT)).toEqual({ name: 'Ujisan - Makati', address: '2129 Chino Roces Ave' })
    expect(placeFromShareText(UJISAN_SHORT, UJISAN_SHORT)).toEqual({})
  })

  it('prefers a shared address, then the pin, then the URL alone', () => {
    const shared = placeFromShareText(`Ujisan - Makati\n${UJISAN_ADDRESS}`, UJISAN_SHORT)
    expect(placePrefill(UJISAN_SHORT, UJISAN_PLACE, opts, shared)).toMatchObject({
      name: 'Ujisan - Makati',
      address: "Bldg 2, King's Court, 2129 Chino Roces Ave",
      area: 'Legazpi Village',
    })
    // Pin only: the barangay along the strip goes by the road's name, not the tiny subdivision.
    expect(placePrefill(UJISAN_SHORT, UJISAN_PLACE, opts)).toMatchObject({ address: 'Dela Rosa Street', area: 'Chino Roces' })
    // Helper unreachable: the URL still gives the name, and the name gives tags.
    expect(placePrefill('https://www.google.com/maps/place/Matcha+Saru/@1,2,17z', null, opts)).toMatchObject({ name: 'Matcha Saru', tags: ['matcha'] })
  })
})
