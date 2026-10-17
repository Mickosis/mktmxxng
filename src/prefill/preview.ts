import { PREVIEW_URL } from '../config'

export type Platform = 'tiktok' | 'instagram' | 'facebook'

export type Preview = {
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

export const PLATFORM_NAMES: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' }

/** First link in pasted text. TikTok's share text sometimes wraps the link in words. */
export function findUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[),.]+$/, '') : null
}

export function platformOf(url: string): Platform | null {
  try {
    return HOSTS[new URL(url).hostname.replace(/^www\./, '')] ?? null
  } catch {
    return null
  }
}

// First path segments that are site pages, not accounts. Kept in step with worker/src/index.ts.
const IG_RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal', 'developer', 'share'])
const FB_RESERVED = new Set([
  'watch', 'reel', 'reels', 'share', 'groups', 'events', 'photo', 'photo.php', 'photos', 'story.php', 'permalink.php',
  'marketplace', 'login', 'login.php', 'home.php', 'videos', 'gaming', 'hashtag', 'help', 'policies', 'privacy',
])

/** True for an account page (tiktok.com/@kumo, instagram.com/kumo, facebook.com/kumo) rather than a post. */
export function isProfile(url: string): boolean {
  const platform = platformOf(url)
  if (!platform) return false
  const u = new URL(url)
  const parts = u.pathname.split('/').filter(Boolean)
  if (platform === 'tiktok') return parts.length === 1 && parts[0].startsWith('@')
  if (platform === 'instagram') return parts.length === 1 && !IG_RESERVED.has(parts[0].toLowerCase())
  if (u.hostname === 'fb.watch') return false
  if (parts[0] === 'profile.php') return u.searchParams.has('id')
  if (parts[0] === 'people') return parts.length >= 2
  return parts.length === 1 && !FB_RESERVED.has(parts[0].toLowerCase())
}

/** The account part of a profile link: kumo.coffee from instagram.com/kumo.coffee/. */
export function handleOf(url: string): string | null {
  if (!isProfile(url)) return null
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  if (parts[0] === 'profile.php') return null
  return decodeURIComponent(parts[0] === 'people' ? parts[1] : parts[0]).replace(/^@/, '')
}

/** Drops tracking params (igsh, utm_*, _r…) from TikTok/IG/FB links; they're never needed to open the post. */
export function cleanLink(url: string): string {
  if (!platformOf(url)) return url
  try {
    const u = new URL(url)
    // Facebook keeps the video id of older watch links in ?v=, and the account id of profile.php in ?id=.
    const v = u.pathname.startsWith('/watch') ? u.searchParams.get('v') : null
    const id = u.pathname === '/profile.php' ? u.searchParams.get('id') : null
    u.search = v ? `?v=${v}` : id ? `?id=${id}` : ''
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

/** Same post or profile, ignoring tracking params, trailing slashes and www. */
export function sameLink(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(cleanLink(u))
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${x.search}`.toLowerCase()
    } catch {
      return u.toLowerCase()
    }
  }
  return norm(a) === norm(b)
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** TikTok's public oEmbed answers browsers directly, but only for full /@user/video/ and /@user links. */
async function tiktokDirect(url: string): Promise<Preview | null> {
  if (platformOf(url) !== 'tiktok') return null
  const profile = isProfile(url)
  if (!profile &&!/tiktok\.com\/@[^/]*\/video\/\d+/.test(url)) return null
  const data = await getJson<{ title?: string; author_url?: string; author_name?: string; thumbnail_url?: string }>(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  )
  if (!data) return null
  const handle = data.author_url?.split('/@')[1]
  const author = handle ? `@${handle}` : data.author_name || null
  return profile
    ? { platform: 'tiktok', kind: 'profile', url, caption: null, author, name: data.author_name || null, thumbnail: null }
    : { platform: 'tiktok', kind: 'post', url, caption: data.title || null, author, name: null, thumbnail: data.thumbnail_url || null }
}

/** Caption of a TikTok, IG or FB post, or name and bio of a profile; null if it can't be read. */
export async function fetchPreview(url: string): Promise<Preview | null> {
  if (PREVIEW_URL) {
    const viaWorker = await getJson<Preview>(`${PREVIEW_URL.replace(/\/$/, '')}/preview?url=${encodeURIComponent(url)}`)
    if (viaWorker?.caption || viaWorker?.name) return { ...viaWorker, kind: viaWorker.kind ?? 'post', name: viaWorker.name ?? null }
  }
  return tiktokDirect(url)
}
