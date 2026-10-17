import { PREVIEW_URL } from '../config'

export type Platform = 'tiktok' | 'instagram' | 'facebook'

export type Preview = {
  platform: Platform
  url: string
  caption: string | null
  author: string | null
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

/** Drops tracking params (igsh, utm_*, _r…) from TikTok/IG/FB links; they're never needed to open the post. */
export function cleanLink(url: string): string {
  if (!platformOf(url)) return url
  try {
    const u = new URL(url)
    // Facebook's older watch links keep the video id in ?v=.
    const v = u.pathname.startsWith('/watch') ? u.searchParams.get('v') : null
    u.search = v ? `?v=${v}` : ''
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

/** Same post, ignoring tracking params, trailing slashes and www. */
export function sameLink(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u)
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase()
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

/** TikTok's public oEmbed answers browsers directly, but only for full /@user/video/ links. */
async function tiktokDirect(url: string): Promise<Preview | null> {
  if (!/tiktok\.com\/@[^/]*\/video\/\d+/.test(url)) return null
  const data = await getJson<{ title?: string; author_url?: string; author_name?: string; thumbnail_url?: string }>(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  )
  if (!data) return null
  const handle = data.author_url?.split('/@')[1]
  return {
    platform: 'tiktok',
    url,
    caption: data.title || null,
    author: handle ? `@${handle}` : data.author_name || null,
    thumbnail: data.thumbnail_url || null,
  }
}

/** Caption and poster for a TikTok, IG or FB post, or null if it can't be read. */
export async function fetchPreview(url: string): Promise<Preview | null> {
  if (PREVIEW_URL) {
    const viaWorker = await getJson<Preview>(`${PREVIEW_URL.replace(/\/$/, '')}/preview?url=${encodeURIComponent(url)}`)
    if (viaWorker?.caption) return viaWorker
  }
  return tiktokDirect(url)
}
