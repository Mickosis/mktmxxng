import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../firebase'
import { DEFAULT_TAGS, isHttpUrl, type Cafe, type CafeInput } from '../types'

type CafesState = {
  cafes: Cafe[]
  loading: boolean
  error: string | null
  tags: string[]
  areas: string[]
  byId: (id: string) => Cafe | undefined
}

const CafesContext = createContext<CafesState | null>(null)

function sortedUnique(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function CafesProvider({ children }: { children: ReactNode }) {
  const [cafes, setCafes] = useState<Cafe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tagDoc, setTagDoc] = useState<string[]>([])
  const [areaDoc, setAreaDoc] = useState<string[]>([])

  useEffect(() => onSnapshot(
    collection(db, 'cafes'),
    (snap) => {
      setCafes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cafe))
      setLoading(false)
      setError(null)
    },
    (err) => {
      setError(err.message)
      setLoading(false)
    },
  ), [])

  useEffect(() => onSnapshot(doc(db, 'taxonomy', 'tags'), (s) => setTagDoc(s.data()?.list ?? [])), [])
  useEffect(() => onSnapshot(doc(db, 'taxonomy', 'areas'), (s) => setAreaDoc(s.data()?.list ?? [])), [])

  const value = useMemo<CafesState>(() => {
    const map = new Map(cafes.map((c) => [c.id, c]))
    return {
      cafes,
      loading,
      error,
      // Union with what cafes actually use, so the lists stay right even if taxonomy lags.
      tags: sortedUnique([...DEFAULT_TAGS, ...tagDoc, ...cafes.flatMap((c) => c.tags)]),
      areas: sortedUnique([...areaDoc, ...cafes.map((c) => c.area)]),
      byId: (id) => map.get(id),
    }
  }, [cafes, loading, error, tagDoc, areaDoc])

  return <CafesContext.Provider value={value}>{children}</CafesContext.Provider>
}

export function useCafes(): CafesState {
  const ctx = useContext(CafesContext)
  if (!ctx) throw new Error('useCafes outside CafesProvider')
  return ctx
}

function clean(input: CafeInput): CafeInput {
  return {
    name: input.name.trim(),
    tags: sortedUnique(input.tags.map((t) => t.toLowerCase())),
    area: input.area.trim(),
    address: input.address.trim(),
    mapsUrl: input.mapsUrl.trim(),
    price: input.price,
    notes: input.notes.trim(),
    work: input.work,
    links: [...new Set(input.links.map((l) => l.trim()).filter(isHttpUrl))].slice(0, 10),
  }
}

async function remember(data: CafeInput) {
  await Promise.all([
    setDoc(doc(db, 'taxonomy', 'tags'), { list: arrayUnion(...data.tags) }, { merge: true }),
    setDoc(doc(db, 'taxonomy', 'areas'), { list: arrayUnion(data.area) }, { merge: true }),
  ])
}

export async function createCafe(input: CafeInput, uid: string): Promise<string> {
  const data = clean(input)
  const ref = await addDoc(collection(db, 'cafes'), {
    ...data,
    nameLower: data.name.toLowerCase(),
    visitCount: 0,
    ratingSum: 0,
    raters: {},
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await remember(data)
  return ref.id
}

export async function updateCafe(id: string, input: CafeInput): Promise<void> {
  const data = clean(input)
  await updateDoc(doc(db, 'cafes', id), {
    ...data,
    nameLower: data.name.toLowerCase(),
    updatedAt: serverTimestamp(),
  })
  await remember(data)
}

export async function deleteCafe(id: string): Promise<void> {
  const visits = await getDocs(collection(db, 'cafes', id, 'visits'))
  const batch = writeBatch(db)
  visits.forEach((v) => batch.delete(v.ref))
  await batch.commit()
  await deleteDoc(doc(db, 'cafes', id))
}
