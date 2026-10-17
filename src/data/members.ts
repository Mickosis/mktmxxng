import { collection, collectionGroup, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase'
import type { Member } from '../types'

export function useMembers(enabled: boolean) {
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!enabled) return
    return onSnapshot(collection(db, 'members'), (snap) => {
      setMembers(
        snap.docs
          .map((d) => ({ email: d.id, ...d.data() }) as Member)
          .sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email)),
      )
    })
  }, [enabled])

  return members
}

export async function addMember(email: string, role: Member['role'], displayName: string) {
  await setDoc(doc(db, 'members', email.trim().toLowerCase()), {
    role,
    displayName: displayName.trim(),
    addedAt: serverTimestamp(),
  })
}

export async function removeMember(email: string) {
  await deleteDoc(doc(db, 'members', email))
}

/** Changes your display name, including on visits you already logged. */
export async function renameSelf(email: string, uid: string, displayName: string) {
  const name = displayName.trim()
  const visits = await getDocs(query(collectionGroup(db, 'visits'), where('uid', '==', uid)))
  const refs = [doc(db, 'members', email), ...visits.docs.map((d) => d.ref)]
  // Batches cap at 500 writes.
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(i, i + 450)) batch.update(ref, { displayName: name })
    await batch.commit()
  }
}
