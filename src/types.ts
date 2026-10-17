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
  visitCount: number
  ratingSum: number
  /** uid -> number of visits logged by that person */
  raters: Record<string, number>
  createdBy: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type CafeInput = Pick<Cafe, 'name' | 'tags' | 'area' | 'address' | 'mapsUrl' | 'price' | 'notes' | 'work'>

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

export function mapsLink(c: Pick<Cafe, 'mapsUrl' | 'name' | 'address'>): string {
  if (c.mapsUrl) return c.mapsUrl
  const q = [c.name, c.address || 'Makati'].join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
