import { collection, collectionGroup, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch, type DocumentReference } from 'firebase/firestore'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../firebase'
import { publicName, shortName, type Visit } from '../types'

/** Public name card for a member, keyed by uid. Member docs stay private; this is what others see. */
export type Profile = {
  uid: string
  name: string
  /** True once the person picked their own name; until then the last name is cut to an initial. */
  nameSet: boolean
}

type ProfilesState = { profiles: Profile[]; byUid: (uid: string) => Profile | undefined }

const ProfilesContext = createContext<ProfilesState | null>(null)

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])

  useEffect(() => onSnapshot(collection(db, 'profiles'), (snap) => {
    setProfiles(
      snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }) as Profile)
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }), [])

  const value = useMemo<ProfilesState>(() => {
    const map = new Map(profiles.map((p) => [p.uid, p]))
    return { profiles, byUid: (uid) => map.get(uid) }
  }, [profiles])

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
}

export function useProfiles() {
  const ctx = useContext(ProfilesContext)
  if (!ctx) throw new Error('useProfiles outside ProfilesProvider')
  return ctx
}

/** The name to show for a uid: their profile, or the name saved on the visit, shortened. */
export function useNameOf() {
  const { byUid } = useProfiles()
  return useCallback((uid: string, fallback = '') => byUid(uid)?.name ?? (fallback ? shortName(fallback) : ''), [byUid])
}

async function commitInChunks(refs: DocumentReference[], data: Record<string, unknown>, first: (b: ReturnType<typeof writeBatch>) => void) {
  // Batches cap at 500 writes.
  for (let i = 0; i < Math.max(refs.length, 1); i += 450) {
    const batch = writeBatch(db)
    if (i === 0) first(batch)
    for (const ref of refs.slice(i, i + 450)) batch.update(ref, data)
    await batch.commit()
  }
}

/**
 * Publishes your name card and puts the same name on visits you already logged, so older
 * visits stop showing a full last name.
 */
export async function saveProfile(uid: string, name: string, nameSet: boolean, memberEmail?: string) {
  const shown = publicName(name, nameSet)
  const visits = await getDocs(query(collectionGroup(db, 'visits'), where('uid', '==', uid)))
  const stale = visits.docs.filter((d) => (d.data() as Visit).displayName !== shown).map((d) => d.ref)
  await commitInChunks(stale, { displayName: shown }, (b) => {
    b.set(doc(db, 'profiles', uid), { name: shown, nameSet, updatedAt: serverTimestamp() })
    if (memberEmail) b.update(doc(db, 'members', memberEmail), { displayName: name.trim() })
  })
}
