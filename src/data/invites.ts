import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase'

export type Invite = {
  token: string
  createdBy: string
  createdAt?: Timestamp
  label: string
  usedBy: string | null
  usedByEmail: string | null
  usedAt: Timestamp | null
}

export const PENDING_INVITE_KEY = 'mk.pendingInvite'

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/join/${token}`
}

export function useInvites(enabled: boolean) {
  const [invites, setInvites] = useState<Invite[]>([])

  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'invites'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setInvites(snap.docs.map((d) => ({ token: d.id, ...d.data() }) as Invite)))
  }, [enabled])

  return invites
}

export async function createInvite(uid: string, label: string): Promise<string> {
  const token = newToken()
  await setDoc(doc(db, 'invites', token), {
    createdBy: uid,
    createdAt: serverTimestamp(),
    label: label.trim(),
    usedBy: null,
    usedByEmail: null,
    usedAt: null,
  })
  return token
}

export async function revokeInvite(token: string) {
  await deleteDoc(doc(db, 'invites', token))
}

export async function getInvite(token: string): Promise<Invite | null> {
  const snap = await getDoc(doc(db, 'invites', token))
  return snap.exists() ? ({ token, ...snap.data() } as Invite) : null
}

/** Uses up the invite and makes you a member, atomically. */
export async function redeemInvite(token: string, uid: string, email: string, displayName: string) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'members', email), { role: 'member', displayName, addedAt: serverTimestamp(), invite: token })
  batch.update(doc(db, 'invites', token), { usedBy: uid, usedByEmail: email, usedAt: serverTimestamp() })
  await batch.commit()
}
