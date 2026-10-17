import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
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
