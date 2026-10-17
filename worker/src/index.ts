// Reads the caption of a TikTok, Instagram or Facebook post, the name and bio of a profile, or
// where a Google/Apple Maps pin is, for the MKTMXXNG add-cafe form. Only answers the app's own
// origins and only fetches those sites (plus OpenStreetMap's geocoder), so it isn't an open proxy.

const ORIGINS = ['https://mickosis.github.io', 'http://localhost:5199']

const HOSTS: Record<string, Platform> = {
  'tiktok.com': 'tiktok',
  'vm.tiktok.com': 'tiktok',
  'vt.tiktok.com': 'tiktok',
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'm.facebook.com': 'facebook',
  'web.facebook.com': 'facebook',
  'fb.watch': 'facebook',
}

type Platform = 'tiktok' | 'instagram' | 'facebook'

type Preview = {
  platform: Platform
  kind: 'post' | 'profile'
  url: string
  /** Post caption, or the profile's bio. */
  caption: string | null
  author: string | null
  /** Display name, for profiles. */
  name: string | null
  thumbnail: string | null
}

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

// First path segments that are site pages, not accounts.
const IG_RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal', 'developer', 'share'])
const FB_RESERVED = new Set([
  'watch', 'reel', 'reels', 'share', 'groups', 'events', 'photo', 'photo.php', 'photos', 'story.php', 'permalink.php',
  'marketplace', 'login', 'login.php', 'home.php', 'videos', 'gaming', 'hashtag', 'help', 'policies', 'privacy',
])

function platformOf(url: URL): Platform | null {
  if (url.protocol !== 'https:') return null
  return HOSTS[url.hostname.replace(/^www\./, '')] ?? null
}

/** True for an account page (tiktok.com/@kumo, instagram.com/kumo, facebook.com/kumo) rather than a post. */
function isProfile(platform: Platform, url: URL): boolean {
  const parts = url.pathname.split('/').filter(Boolean)
  if (platform === 'tiktok') return parts.length === 1 && parts[0].startsWith('@')
  if (platform === 'instagram') return parts.length === 1 && !IG_RESERVED.has(parts[0].toLowerCase())
  if (url.hostname === 'fb.watch') return false
  if (parts[0] === 'profile.php') return url.searchParams.has('id')
  if (parts[0] === 'people') return parts.length >= 2
  return parts.length === 1 && !FB_RESERVED.has(parts[0].toLowerCase())
}

// Maps share links are short redirects; only these hosts are followed.
const MAPS_SHORT = new Set(['maps.app.goo.gl', 'goo.gl', 'maps.apple'])
const MAPS_FULL = /^(www\.)?google\.[a-z.]+$|^maps\.google\.[a-z.]+$|^maps\.apple\.com$|^maps\.apple$/
const GEOCODER_UA = 'mktmxxng-preview/1.0 (https://github.com/Mickosis/mktmxxng)'

function isMapsHost(url: URL): boolean {
  return url.protocol === 'https:' && (MAPS_SHORT.has(url.hostname) || MAPS_FULL.test(url.hostname))
}

type Place = {
  url: string
  lat: number | null
  lng: number | null
  /** House number and street, from OpenStreetMap. */
  street: string | null
  /** Village or district, e.g. Legazpi Village or Poblacion. */
  area: string | null
  city: string | null
}

/** Follows a Maps short link to the full place URL, which carries the name and the pin. */
async function resolveMaps(url: URL): Promise<URL> {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    if (!MAPS_SHORT.has(current.hostname)) break
    const res = await fetch(current.toString(), { redirect: 'manual', headers: { 'User-Agent': BROWSER_UA } })
    const next = res.headers.get('Location')
    if (res.status < 300 || res.status >= 400 || !next) break
    const target = new URL(next, current)
    if (!isMapsHost(target)) break
    current = target
  }
  return current
}

/** The pin's coordinates: Google's !3d…!4d… (the place itself) beats @lat,lng (the map's centre). */
function coordsOf(url: URL): [number, number] | null {
  const text = decodeURIComponent(url.toString())
  const m =
    text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ??
    text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ??
    text.match(/[?&](?:ll|coordinate|q|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** Street and village for a pin, from OpenStreetMap's free reverse geocoder. */
async function reverseGeocode(lat: number, lng: number): Promise<Pick<Place, 'street' | 'area' | 'city'>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
    { headers: { 'User-Agent': GEOCODER_UA } },
  )
  if (!res.ok) return { street: null, area: null, city: null }
  const { address: a = {} } = (await res.json()) as { address?: Record<string, string> }
  const street = [a.house_number, a.road].filter(Boolean).join(' ') || null
  return { street, area: a.neighbourhood || a.quarter || a.suburb || null, city: a.city || a.town || null }
}

async function place(url: URL): Promise<Place> {
  const full = await resolveMaps(url)
  const coords = coordsOf(full)
  const found = coords ? await reverseGeocode(...coords) : { street: null, area: null, city: null }
  return { url: full.toString(), lat: coords?.[0] ?? null, lng: coords?.[1] ?? null, ...found }
}

function cors(origin: string | null): Record<string, string> {
  return origin && ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET', Vary: 'Origin' }
    : { Vary: 'Origin' }
}

function json(body: unknown, status: number, origin: string | null, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cache ? 'public, max-age=86400' : 'no-store',
      ...cors(origin),
    },
  })
}

/** Follows short links (vm.tiktok.com, tiktok.com/t/, fb.watch, facebook.com/share/) to the real URL. */
async function resolve(url: URL): Promise<URL> {
  let current = url
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current.toString(), { redirect: 'manual', headers: { 'User-Agent': BROWSER_UA } })
    const next = res.headers.get('Location')
    if (res.status < 300 || res.status >= 400 || !next) break
    const target = new URL(next, current)
    if (!platformOf(target)) break
    current = target
  }
  // profile.php keeps the account id in ?id=; everything else in the query is tracking.
  const id = current.pathname === '/profile.php' ? current.searchParams.get('id') : null
  current.search = id ? `?id=${id}` : ''
  current.hash = ''
  return current
}

function blank(platform: Platform, url: URL): Preview {
  return { platform, kind: isProfile(platform, url) ? 'profile' : 'post', url: url.toString(), caption: null, author: null, name: null, thumbnail: null }
}

async function tiktok(url: URL): Promise<Preview> {
  const isShort = url.hostname !== 'www.tiktok.com' && url.hostname !== 'tiktok.com'
  const full = isShort || url.pathname.startsWith('/t/') ? await resolve(url) : url
  const empty = blank('tiktok', full)
  // oEmbed also answers for profile links, with the display name but no bio.
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(full.toString())}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(endpoint, { headers: { 'User-Agent': BROWSER_UA } })
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string }
      const handle = data.author_url?.split('/@')[1]
      const author = handle ? `@${handle}` : data.author_name || null
      return empty.kind === 'profile'
        ? { ...empty, author, name: data.author_name || null }
        : { ...empty, caption: data.title || null, author, thumbnail: data.thumbnail_url || null }
    }
    // TikTok sheds load with 503 "overload-protect"; a short wait usually clears it.
    if (res.status !== 503) break
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
  }
  return empty
}

function meta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i')
  const raw = re.exec(html)?.[1] ?? alt.exec(html)?.[1]
  return raw ? decode(raw) : null
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Instagram and Facebook only show captions and bios in link-preview tags, and not always. Best effort. */
async function meta_platform(platform: 'instagram' | 'facebook', url: URL): Promise<Preview> {
  const short = url.hostname === 'fb.watch' || url.pathname.startsWith('/share/')
  const full = short ? await resolve(url) : url
  const empty = blank(platform, full)
  const res = await fetch(full.toString(), { headers: { 'User-Agent': CRAWLER_UA, 'Accept-Language': 'en' } })
  if (!res.ok) return empty
  const html = (await res.text()).slice(0, 400_000)
  const title = meta(html, 'og:title')
  const description = meta(html, 'og:description')
  const thumbnail = meta(html, 'og:image')
  // A login wall shows up as a generic "Instagram"/"Facebook"/"Log in" title.
  if (title && /^(instagram|facebook|log in|log into facebook)\b/i.test(title)) return empty

  if (platform === 'instagram' && empty.kind === 'profile') {
    // og:title: Kumo Coffee (@kumo.coffee) • Instagram photos and videos
    // description: 1K Followers, … - Kumo Coffee (@kumo.coffee) on Instagram: "bio"
    const who = title?.match(/^(.*?)\s*\(@([\w.]+)\)/)
    const bio = meta(html, 'description')?.match(/on Instagram:\s*["“](.*)["”]\s*$/s)?.[1] ?? null
    return { ...empty, name: who?.[1] || null, author: who?.[2] ? `@${who[2]}` : null, caption: bio, thumbnail }
  }

  if (platform === 'instagram') {
    // e.g. 123 likes, 4 comments - kumo.coffee on October 1, 2026: "caption here"
    const m = description?.match(/-\s*([\w.]+)\s+on\s+[^:]+:\s*["“](.*)["”]\s*\.?\s*$/s)
    const caption = m?.[2] ?? (title?.match(/:\s*["“](.*)["”]/s)?.[1] ?? null)
    return { ...empty, caption, author: m?.[1] ? `@${m[1]}` : null, thumbnail }
  }

  if (empty.kind === 'profile') {
    // og:title: Kumo Coffee | Makati   description: Kumo Coffee, Makati. 31,125 followers · 12 talking about this · 9 were here. Intro
    const [name, ...place] = (title ?? '').split(/\s+[|•·]\s+/)
    const intro = (description ?? '')
      .replace(/[\d.,]+\s*[KkMm]?\s+(followers?|likes?|talking about this|were here|following)\b\.?/g, '')
      .replace(/\s*·\s*/g, ' ')
      .trim()
    const bio = [place.join(', '), intro].filter(Boolean).join('\n')
    return { ...empty, name: name?.trim() || null, caption: bio || null, thumbnail }
  }

  // Facebook puts a post's caption in og:description (or og:title for reels).
  return { ...empty, caption: description || title || null, thumbnail }
}

export default {
  async fetch(request: Request, _env: unknown, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })

    const { pathname, searchParams } = new URL(request.url)
    if (request.method === 'GET' && pathname === '/place') {
      let target: URL
      try {
        target = new URL(searchParams.get('url') ?? '')
      } catch {
        return json({ error: 'Pass a full https:// link.' }, 400, origin)
      }
      if (!isMapsHost(target)) return json({ error: 'Only Google Maps and Apple Maps links are supported.' }, 400, origin)
      // Places don't move, so cache longer; this also keeps us well inside OpenStreetMap's rate limit.
      const key = new Request(`https://preview.cache/place/${encodeURIComponent(target.toString())}`)
      const hit = await caches.default.match(key)
      if (hit) return new Response(await hit.text(), { headers: { 'Content-Type': 'application/json', ...cors(origin) } })
      try {
        const found = await place(target)
        if (found.lat != null) {
          ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(found), { headers: { 'Cache-Control': 'max-age=2592000' } })))
        }
        return json(found, 200, origin, found.lat != null)
      } catch {
        return json({ url: target.toString(), lat: null, lng: null, street: null, area: null, city: null }, 200, origin)
      }
    }
    if (request.method !== 'GET' || pathname !== '/preview') return json({ error: 'Not found' }, 404, origin)

    let target: URL
    try {
      target = new URL(searchParams.get('url') ?? '')
    } catch {
      return json({ error: 'Pass a full https:// link.' }, 400, origin)
    }
    const platform = platformOf(target)
    if (!platform) return json({ error: 'Only TikTok, Instagram and Facebook links are supported.' }, 400, origin)

    const cache = caches.default
    // v2: responses gained kind and name.
    const key = new Request(`https://preview.cache/v2/${encodeURIComponent(target.toString())}`)
    const hit = await cache.match(key)
    if (hit) {
      const body = await hit.text()
      return new Response(body, { headers: { 'Content-Type': 'application/json', ...cors(origin) } })
    }

    try {
      const preview = platform === 'tiktok' ? await tiktok(target) : await meta_platform(platform, target)
      const found = !!(preview.caption || preview.name)
      if (found) {
        ctx.waitUntil(cache.put(key, new Response(JSON.stringify(preview), { headers: { 'Cache-Control': 'max-age=86400' } })))
      }
      return json(preview, 200, origin, found)
    } catch {
      return json(blank(platform, target), 200, origin)
    }
  },
}
