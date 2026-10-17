// Reads the caption of a TikTok, Instagram or Facebook post for the MKTMXXNG add-cafe form.
// Only answers the app's own origins and only fetches those three sites, so it isn't an open proxy.

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
  url: string
  caption: string | null
  author: string | null
  thumbnail: string | null
}

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

function platformOf(url: URL): Platform | null {
  if (url.protocol !== 'https:') return null
  return HOSTS[url.hostname.replace(/^www\./, '')] ?? null
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

/** Follows short links (vm.tiktok.com, tiktok.com/t/, fb.watch) to the real post URL. */
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
  current.search = ''
  current.hash = ''
  return current
}

async function tiktok(url: URL): Promise<Preview> {
  const isShort = url.hostname !== 'www.tiktok.com' && url.hostname !== 'tiktok.com'
  const full = isShort || url.pathname.startsWith('/t/') ? await resolve(url) : url
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(full.toString())}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(endpoint, { headers: { 'User-Agent': BROWSER_UA } })
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string }
      const handle = data.author_url?.split('/@')[1]
      return {
        platform: 'tiktok',
        url: full.toString(),
        caption: data.title || null,
        author: handle ? `@${handle}` : data.author_name || null,
        thumbnail: data.thumbnail_url || null,
      }
    }
    // TikTok sheds load with 503 "overload-protect"; a short wait usually clears it.
    if (res.status !== 503) break
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
  }
  return { platform: 'tiktok', url: full.toString(), caption: null, author: null, thumbnail: null }
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

/** Instagram and Facebook only show captions in link-preview tags, and not always. Best effort. */
async function meta_platform(platform: 'instagram' | 'facebook', url: URL): Promise<Preview> {
  const full = platform === 'facebook' && url.hostname === 'fb.watch' ? await resolve(url) : url
  const empty: Preview = { platform, url: full.toString(), caption: null, author: null, thumbnail: null }
  const res = await fetch(full.toString(), { headers: { 'User-Agent': CRAWLER_UA, 'Accept-Language': 'en' } })
  if (!res.ok) return empty
  const html = (await res.text()).slice(0, 400_000)
  const title = meta(html, 'og:title')
  const description = meta(html, 'og:description')
  const thumbnail = meta(html, 'og:image')

  if (platform === 'instagram') {
    // e.g. 123 likes, 4 comments - kumo.coffee on October 1, 2026: "caption here"
    const m = description?.match(/-\s*([\w.]+)\s+on\s+[^:]+:\s*["“](.*)["”]\s*\.?\s*$/s)
    const caption = m?.[2] ?? (title?.match(/:\s*["“](.*)["”]/s)?.[1] ?? null)
    return { ...empty, caption, author: m?.[1] ? `@${m[1]}` : null, thumbnail }
  }

  // Facebook puts the caption in og:description (or og:title for reels); "Facebook"/"Log in" means a login wall.
  const caption = [description, title].find((t) => t && !/^(facebook|log in|log into facebook)/i.test(t)) ?? null
  return { ...empty, caption, thumbnail }
}

export default {
  async fetch(request: Request, _env: unknown, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })

    const { pathname, searchParams } = new URL(request.url)
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
    const key = new Request(`https://preview.cache/${encodeURIComponent(target.toString())}`)
    const hit = await cache.match(key)
    if (hit) {
      const body = await hit.text()
      return new Response(body, { headers: { 'Content-Type': 'application/json', ...cors(origin) } })
    }

    try {
      const preview = platform === 'tiktok' ? await tiktok(target) : await meta_platform(platform, target)
      if (preview.caption) {
        ctx.waitUntil(cache.put(key, new Response(JSON.stringify(preview), { headers: { 'Cache-Control': 'max-age=86400' } })))
      }
      return json(preview, 200, origin, !!preview.caption)
    } catch {
      return json({ platform, url: target.toString(), caption: null, author: null, thumbnail: null }, 200, origin)
    }
  },
}
