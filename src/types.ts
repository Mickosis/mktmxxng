import type { Timestamp } from 'firebase/firestore'

export type WorkFlag = 'wifi' | 'outlets' | 'laptop'
export type Work = Record<WorkFlag, boolean>

export const WORK_LABELS: Record<WorkFlag, string> = {
  wifi: 'Wifi',
  outlets: 'Outlets',
  laptop: 'Laptop-OK',
}

export const DEFAULT_TAGS = ['coffee', 'matcha', 'pastries', 'restaurant']

export type Cafe = {
  id: string
  name: string
  nameLower: string
  tags: string[]
  area: string
  address: string
  mapsUrl: string
  /** 0 = not set, 1–3 = ₱ to ₱₱₱ */
  price: number
  notes: string
  work: Work
  /** TikTok, IG Reels, YouTube etc. Older cafes may not have it. */
  links?: string[]
  visitCount: number
  ratingSum: number
  /** uid -> number of visits logged by that person */
  raters: Record<string, number>
  createdBy: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type CafeInput = Pick<Cafe, 'name' | 'tags' | 'area' | 'address' | 'mapsUrl' | 'price' | 'notes' | 'work'> & { links: string[] }

export type OrderItem = { name: string; rating?: number }

export type Visit = {
  id: string
  uid: string
  displayName: string
  /** YYYY-MM-DD */
  date: string
  rating: number
  items: OrderItem[]
  note: string
  createdAt?: Timestamp
}

export type VisitInput = Pick<Visit, 'date' | 'rating' | 'items' | 'note'>

export type Member = {
  email: string
  role: 'admin' | 'member'
  displayName?: string
  addedAt?: Timestamp
}

export function average(c: Pick<Cafe, 'visitCount' | 'ratingSum'>): number | null {
  return c.visitCount > 0 ? c.ratingSum / c.visitCount : null
}

export function pesos(price: number): string {
  return price > 0 ? '₱'.repeat(price) : ''
}

export function mapsLink(c: Pick<Cafe, 'mapsUrl' | 'name' | 'address' | 'area'>): string {
  if (c.mapsUrl) return c.mapsUrl
  const q = [c.name, c.address, c.area, 'Makati'].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(facebook\.com|fb\.watch)$/, 'Facebook'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'X'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
]

/** Short label for a social link, e.g. "Instagram reel" or the site's domain. */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const platform = PLATFORMS.find(([re]) => re.test(host))?.[1]
    if (!platform) return host
    if (platform === 'Instagram' && /^\/(reels?|tv)\//.test(u.pathname)) return 'Instagram reel'
    if (platform === 'YouTube' && u.pathname.startsWith('/shorts/')) return 'YouTube short'
    return platform
  } catch {
    return url
  }
}

export function isHttpUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}
