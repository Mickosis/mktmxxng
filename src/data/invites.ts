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
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase'

export type Invite = {
  token: string
  createdBy: string
  createdAt?: Timestamp
  label: string
  /** Missing on invites made before links expired. */
  expiresAt?: Timestamp
}

export const INVITE_DAYS = 7

export function isExpired(invite: Invite): boolean {
  return !invite.expiresAt || invite.expiresAt.toMillis() <= Date.now()
}

/** Whole days left, rounded up, so a link made today reads "7 days". */
export function daysLeft(invite: Invite): number {
  return invite.expiresAt ? Math.max(0, Math.ceil((invite.expiresAt.toMillis() - Date.now()) / 86_400_000)) : 0
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
    label: label.trim().slice(0, 60),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86_400_000),
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

/** Makes you a member and deletes the invite in one step, so it can't be used again. */
export async function redeemInvite(invite: Invite, email: string, displayName: string) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'members', email), {
    role: 'member',
    displayName,
    addedAt: serverTimestamp(),
    invite: invite.token,
    inviteLabel: invite.label,
  })
  batch.delete(doc(db, 'invites', invite.token))
  await batch.commit()
}

/** Admin cleanup: expired links, plus used ones left over from before links were deleted on use. */
export async function purgeStaleInvites(invites: (Invite & { usedBy?: unknown })[]) {
  const stale = invites.filter((i) => isExpired(i) || i.usedBy)
  if (!stale.length) return
  const batch = writeBatch(db)
  stale.forEach((i) => batch.delete(doc(db, 'invites', i.token)))
  await batch.commit()
}
