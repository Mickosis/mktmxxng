import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, db } from './firebase'
import type { Member } from './types'
import { storage } from './storage'

const EMAIL_KEY = 'mk.emailForSignIn'

type AuthState = {
  user: User | null
  loading: boolean
  member: Member | null
  isMember: boolean
  isAdmin: boolean
  /** null while unknown */
  bootstrapped: boolean | null
  /** set when the page was opened from an email link on a device that doesn't know the email */
  pendingLink: string | null
  displayName: string
  signInWithGoogle: () => Promise<void>
  sendEmailLink: (email: string) => Promise<void>
  completeEmailLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  claimAdmin: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function cleanUrl() {
  const url = new URL(window.location.href)
  window.history.replaceState(null, '', url.origin + url.pathname + url.hash)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [memberState, setMemberState] = useState<{ email: string; member: Member | null } | null>(null)
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null)
  // Opened from an email link on a device that doesn't remember the email: ask for it.
  const [pendingLink, setPendingLink] = useState<string | null>(() =>
    isSignInWithEmailLink(auth, window.location.href) && !storage.get(EMAIL_KEY) ? window.location.href : null,
  )

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u)
    setLoading(false)
  }), [])

  // Finish an email-link sign-in when the page was opened from the link.
  useEffect(() => {
    const href = window.location.href
    if (!isSignInWithEmailLink(auth, href)) return
    const email = storage.get(EMAIL_KEY)
    if (!email) return
    signInWithEmailLink(auth, email, href)
      .then(() => storage.remove(EMAIL_KEY))
      .catch(() => setPendingLink(href))
      .finally(cleanUrl)
  }, [])

  useEffect(() => onSnapshot(
    doc(db, 'config', 'bootstrap'),
    (snap) => setBootstrapped(snap.exists()),
    () => setBootstrapped(null),
  ), [])

  const email = user?.email?.toLowerCase() ?? null
  useEffect(() => {
    if (!email) return
    return onSnapshot(
      doc(db, 'members', email),
      (snap) => setMemberState({ email, member: snap.exists() ? ({ email, ...snap.data() } as Member) : null }),
      () => setMemberState({ email, member: null }),
    )
  }, [email])
  const member = email && memberState?.email === email ? memberState.member : null

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }, [])

  const sendEmailLink = useCallback(async (address: string) => {
    const url = window.location.origin + import.meta.env.BASE_URL
    await sendSignInLinkToEmail(auth, address, { url, handleCodeInApp: true })
    storage.set(EMAIL_KEY, address)
  }, [])

  const completeEmailLink = useCallback(async (address: string) => {
    if (!pendingLink) return
    await signInWithEmailLink(auth, address, pendingLink)
    setPendingLink(null)
    cleanUrl()
  }, [pendingLink])

  const signOut = useCallback(() => fbSignOut(auth), [])

  const claimAdmin = useCallback(async () => {
    if (!user || !email) return
    const batch = writeBatch(db)
    batch.set(doc(db, 'members', email), {
      role: 'admin',
      displayName: user.displayName ?? email.split('@')[0],
      addedAt: serverTimestamp(),
    })
    batch.set(doc(db, 'config', 'bootstrap'), { uid: user.uid, at: serverTimestamp() })
    await batch.commit()
  }, [user, email])

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    member,
    isMember: !!member,
    isAdmin: member?.role === 'admin',
    bootstrapped,
    pendingLink,
    displayName: member?.displayName || user?.displayName || email?.split('@')[0] || '',
    signInWithGoogle,
    sendEmailLink,
    completeEmailLink,
    signOut,
    claimAdmin,
  }), [user, loading, member, bootstrapped, pendingLink, email, signInWithGoogle, sendEmailLink, completeEmailLink, signOut, claimAdmin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
