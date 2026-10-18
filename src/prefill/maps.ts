import { PREVIEW_URL } from '../config'
import { findArea, parseCaption, type Prefill } from './parse'

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'maps.apple'])

/** Google Maps or Apple Maps, full or short. */
export function isMapsLink(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'goo.gl') return u.pathname.startsWith('/maps')
    if (SHORT_HOSTS.has(host) || host === 'maps.apple.com') return true
    if (/^maps\.google\.[a-z.]+$/.test(host)) return true
    return /^google\.[a-z.]+$/.test(host) && u.pathname.startsWith('/maps')
  } catch {
    return false
  }
}

// Google query params that pick the place; the rest (entry, g_ep, g_st, utm_*) is tracking.
const KEEP = new Set(['q', 'query', 'api', 'cid', 'ftid', 'query_place_id', 'll'])

/** Drops tracking params from a Maps link. Apple's params all describe the place, so they stay. */
export function cleanMapsLink(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'maps.apple.com') return url
    for (const key of [...u.searchParams.keys()]) if (!KEEP.has(key)) u.searchParams.delete(key)
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

export function isShortMapsLink(url: string): boolean {
  try {
    return SHORT_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

// Address parts that only repeat the city or country.
const FILLER = /^(\d{4}\s+)?(metro manila|ncr|national capital region|philippines|makati( city)?)(\s+\d{4})?$|^\d{4}$/i

function words(s: string) {
  return s.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Name and address straight from a Maps URL. Google puts "Name" or "Name, street, city" after
 * /place/ (or in ?q=); Apple uses ?q= (or ?name=) and ?address=.
 */
export function placeFromUrl(url: string): { name?: string; address?: string } {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return {}
  }
  const apple = u.hostname.endsWith('maps.apple.com') || u.hostname === 'maps.apple'
  if (apple) {
    const name = words(u.searchParams.get('name') ?? u.searchParams.get('q') ?? '')
    const address = words(u.searchParams.get('address') ?? '')
    return { name: name || undefined, address: tidyAddress(address.split(',')) }
  }
  const segment = u.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/)?.[1]
  const raw = words(decodeURIComponent(segment ?? u.searchParams.get('q') ?? u.searchParams.get('query') ?? ''))
  // Bare coordinates, or a Google place id, say nothing about the name.
  if (!raw || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(raw) || /^place_id:/i.test(raw)) return {}
  const [name, ...rest] = raw.split(',').map((p) => p.trim())
  return { name: name || undefined, address: tidyAddress(rest) }
}

function tidyAddress(parts: string[]): string | undefined {
  const kept = parts.map((p) => p.trim()).filter((p) => p && !FILLER.test(p))
  return kept.length ? kept.join(', ') : undefined
}

export type Place = {
  url: string
  lat: number | null
  lng: number | null
  street: string | null
  area: string | null
  /** OpenStreetMap area names around the pin, smallest first. */
  areas?: string[]
  city: string | null
}

/**
 * Name and address from text shared along with a Maps link. Sharing a place from Google Maps to
 * Messages or Notes gives "Ujisan - Makati\nBldg 2, King's Court, 2129 Chino Roces Ave, …\nhttps://…"
 * (sometimes on one line, split by " · "); Copy link gives the link alone.
 */
export function placeFromShareText(text: string, link: string): { name?: string; address?: string } {
  const parts = text
    .replace(link, '\n')
    .split(/\n| · /)
    .map((p) => p.trim())
    .filter((p) => p && !/^https?:\/\//i.test(p))
  if (!parts.length) return {}
  const [first, ...rest] = parts
  // A lone line with commas is an address with no name.
  if (!rest.length && first.includes(',')) return { address: first }
  return { name: first, address: rest.join(', ') || undefined }
}

/** Follows a short link and looks up street and area for the pin. Null if the helper is unreachable. */
export async function fetchPlace(url: string): Promise<Place | null> {
  if (!PREVIEW_URL) return null
  try {
    const res = await fetch(`${PREVIEW_URL.replace(/\/$/, '')}/place?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(9000) })
    return res.ok ? ((await res.json()) as Place) : null
  } catch {
    return null
  }
}

/** Everything a Maps link tells us, as a pre-fill. The URL wins for name; a shared address beats the pin's nearest street. */
export function placePrefill(
  url: string,
  place: Place | null,
  opts: { tags: string[]; areas: string[] },
  shared: { name?: string; address?: string } = {},
): Prefill {
  const fromUrl = placeFromUrl(place?.url ?? url)
  const name = fromUrl.name ?? shared.name
  const listed = shared.address
  // The name says things like "Kumo Coffee" or "Matcha Bar", which map onto tags.
  const parsed = parseCaption([name, fromUrl.address].filter(Boolean).join('\n'), opts)

  // A named village in the shared address (Legaspi Village) beats OSM's barangay, which beats a tiny subdivision.
  const area =
    [listed, fromUrl.address, ...(place?.areas ?? [])].reduce<string | undefined>((hit, text) => hit ?? (text ? findArea(text, opts.areas) : undefined), undefined) ??
    place?.area ??
    parsed.area

  return {
    ...parsed,
    name,
    address: (listed && streetPart(listed, area, opts.areas)) ?? fromUrl.address ?? place?.street ?? undefined,
    area,
    mentions: [],
  }
}

const STREETISH = /\d|\b(st|street|ave|avenue|road|rd|blvd|bldg|building|tower|drive|dr)\b/i

/** "Bldg 2, King's Court, 2129 Chino Roces Ave, Legaspi Village, Makati City, 1229 Metro Manila" without the area, city and postcode. */
function streetPart(address: string, area: string | undefined, areas: string[]): string | undefined {
  // "Legaspi Village" goes; "Legazpi Street" stays.
  const parts = address.split(',').filter((p) => !(area && findArea(p, areas) === area && !STREETISH.test(p)))
  return tidyAddress(parts)
}
