import { session } from './storage'
import type { Cafe, WorkFlag } from './types'

export type Status = 'any' | 'new' | 'been'

export type Filters = {
  tags: string[]
  area: string
  price: number
  status: Status
  work: WorkFlag[]
  mine: boolean
}

export const EMPTY_FILTERS: Filters = { tags: [], area: '', price: 0, status: 'any', work: [], mine: false }

export function activeFilterCount(f: Filters): number {
  return f.tags.length + (f.area ? 1 : 0) + (f.price ? 1 : 0) + (f.status !== 'any' ? 1 : 0) + f.work.length + (f.mine ? 1 : 0)
}

export function matches(c: Cafe, f: Filters, uid: string | undefined): boolean {
  if (f.tags.length && !f.tags.some((t) => c.tags.includes(t))) return false
  if (f.area && c.area !== f.area) return false
  // Price filter means "this or cheaper"; unpriced cafes still qualify.
  if (f.price && c.price > f.price) return false
  if (f.status === 'new' && c.visitCount > 0) return false
  if (f.status === 'been' && c.visitCount === 0) return false
  if (f.work.some((w) => !c.work?.[w])) return false
  if (f.mine && !(uid && (c.raters?.[uid] ?? 0) > 0)) return false
  return true
}

const RECENT_KEY = 'mk.recentPicks'
const RECENT_SIZE = 3

/** Uniform random pick, skipping the last few picks when anything else is available. */
export function pick(candidates: Cafe[]): Cafe | null {
  if (!candidates.length) return null
  const recent = session.getJSON<string[]>(RECENT_KEY, [])
  const fresh = candidates.filter((c) => !recent.includes(c.id))
  const pool = fresh.length ? fresh : candidates
  const choice = pool[Math.floor(Math.random() * pool.length)]
  session.setJSON(RECENT_KEY, [choice.id, ...recent.filter((id) => id !== choice.id)].slice(0, RECENT_SIZE))
  return choice
}
