import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase'
import type { OrderItem, Visit, VisitInput } from '../types'

const NO_VISITS: Visit[] = []

export function useVisits(cafeId: string | undefined) {
  const [state, setState] = useState<{ cafeId: string; visits: Visit[] } | null>(null)

  useEffect(() => {
    if (!cafeId) return
    const q = query(collection(db, 'cafes', cafeId, 'visits'), orderBy('date', 'desc'))
    return onSnapshot(
      q,
      (snap) => setState({ cafeId, visits: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Visit) }),
      () => setState({ cafeId, visits: NO_VISITS }),
    )
  }, [cafeId])

  const current = state?.cafeId === cafeId ? state : null
  return { visits: current?.visits ?? NO_VISITS, loading: !current }
}

function cleanItems(items: OrderItem[]): OrderItem[] {
  return items
    .map((i) => ({ name: i.name.trim(), ...(i.rating ? { rating: i.rating } : {}) }))
    .filter((i) => i.name)
}

export async function addVisit(cafeId: string, input: VisitInput, uid: string, displayName: string) {
  const cafeRef = doc(db, 'cafes', cafeId)
  const visitRef = doc(collection(cafeRef, 'visits'))
  const batch = writeBatch(db)
  batch.set(visitRef, {
    ...input,
    note: input.note.trim(),
    items: cleanItems(input.items),
    uid,
    displayName,
    createdAt: serverTimestamp(),
  })
  batch.update(cafeRef, {
    visitCount: increment(1),
    ratingSum: increment(input.rating),
    [`raters.${uid}`]: increment(1),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export async function updateVisit(cafeId: string, visitId: string, input: VisitInput) {
  const cafeRef = doc(db, 'cafes', cafeId)
  const visitRef = doc(cafeRef, 'visits', visitId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(visitRef)
    if (!snap.exists()) throw new Error('That visit no longer exists.')
    const old = snap.data() as Visit
    tx.update(visitRef, { ...input, note: input.note.trim(), items: cleanItems(input.items) })
    tx.update(cafeRef, { ratingSum: increment(input.rating - old.rating), updatedAt: serverTimestamp() })
  })
}

export async function deleteVisit(cafeId: string, visitId: string) {
  const cafeRef = doc(db, 'cafes', cafeId)
  const visitRef = doc(cafeRef, 'visits', visitId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(visitRef)
    if (!snap.exists()) return
    const old = snap.data() as Visit
    tx.delete(visitRef)
    tx.update(cafeRef, {
      visitCount: increment(-1),
      ratingSum: increment(-old.rating),
      [`raters.${old.uid}`]: increment(-1),
      updatedAt: serverTimestamp(),
    })
  })
}

export type ItemMemory = { name: string; count: number; avg: number | null }

/** Everything ordered at a cafe, most-ordered first, with average item rating where rated. */
export function itemMemory(visits: Visit[]): ItemMemory[] {
  const map = new Map<string, { name: string; count: number; sum: number; rated: number }>()
  for (const v of visits) {
    for (const item of v.items ?? []) {
      const key = item.name.toLowerCase()
      const entry = map.get(key) ?? { name: item.name, count: 0, sum: 0, rated: 0 }
      entry.count += 1
      if (item.rating) {
        entry.sum += item.rating
        entry.rated += 1
      }
      map.set(key, entry)
    }
  }
  return [...map.values()]
    .map((e) => ({ name: e.name, count: e.count, avg: e.rated ? e.sum / e.rated : null }))
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0) || a.name.localeCompare(b.name))
}
