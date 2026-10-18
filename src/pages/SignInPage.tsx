import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Slip } from '../components/Shell'
import { saveProfile } from '../data/profiles'

export function message(err: unknown): string {
  const code = (err as { code?: string }).code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return ''
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
  if (code === 'auth/invalid-email') return 'That email address looks wrong.'
  if (code === 'auth/invalid-action-code') return 'That sign-in link expired or was already used. Send a new one.'
  return (err as Error).message
}

export function SignInPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(message(err) || null)
    } finally {
      setBusy(false)
    }
  }

  if (auth.loading) return <Slip><p className="muted">Checking sign-in…</p></Slip>

  if (auth.pendingLink && !auth.user) {
    return (
      <Slip>
        <form className="form" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(() => auth.completeEmailLink(email)) }}>
          <h1>Finish signing in</h1>
          <p>You opened the link on a different device or browser. Enter the email you sent it to.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-ink" disabled={busy}>Sign in</button>
        </form>
      </Slip>
    )
  }

  if (auth.user) {
    return (
      <Slip>
        <h1>{auth.displayName}</h1>
        <p className="muted">{auth.user.email}</p>
        <hr className="rule" />
        {auth.isMember ? (
          <>
            <p>You're {auth.isAdmin ? 'an admin' : 'a member'}. You can add cafes and log visits.</p>
            <RenameForm />
          </>
        ) : auth.bootstrapped === false ? (
          <>
            <p>Nobody runs this list yet. Claim admin to start adding cafes and inviting people. Only the first person can do this.</p>
            <button className="btn btn-ink" disabled={busy} onClick={() => run(auth.claimAdmin)}>Claim admin</button>
          </>
        ) : (
          <p>You can browse and roll, but this email isn't on the member list yet. Ask the admin to invite {auth.user.email}.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          {auth.isAdmin && <Link className="btn" to="/members">Manage members</Link>}
          <button className="btn" onClick={() => run(auth.signOut)}>Sign out</button>
        </div>
        <p className="muted small">Version {__BUILD__}</p>
      </Slip>
    )
  }

  return (
    <Slip>
      <h1>Sign in</h1>
      <p className="muted">Anyone can browse and roll. Sign in if you've been invited to add cafes and log visits.</p>
      <SignInOptions />
    </Slip>
  )
}

/** Google button + email-link form. Shared by the sign-in and join pages. */
export function SignInOptions() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(message(err) || null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn btn-ink btn-block" disabled={busy} onClick={() => run(auth.signInWithGoogle)}>
        Continue with Google
      </button>
      <hr className="rule rule-or" data-label="or" />
      {sent ? (
        <p className="ok" role="status">Link sent to {email}. Open it on this device to finish signing in.</p>
      ) : (
        <form className="form" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await auth.sendEmailLink(email); setSent(true) }) }}>
          <label className="field">
            <span>Email me a sign-in link</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <button className="btn" disabled={busy}>Send link</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

function RenameForm() {
  const { user, displayName, publicName, nameSet } = useAuth()
  const [name, setName] = useState(displayName)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const trimmed = name.trim()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user?.email || !trimmed) return
    setBusy(true)
    setStatus(null)
    try {
      await saveProfile(user.uid, trimmed, true, user.email.toLowerCase())
      setStatus({ ok: true, text: 'Name saved.' })
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Display name</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
      </label>
      <p className="muted small">
        Shown on cafes you add and visits you log, including older ones.
        {nameSet ? ` Others see “${publicName}”.` : ` Until you save a name, others see “${publicName}”.`}
      </p>
      {status && <p className={status.ok ? 'ok' : 'error'} role={status.ok ? 'status' : 'alert'}>{status.text}</p>}
      <button className="btn" disabled={busy || !trimmed || (nameSet && trimmed === displayName)}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  )
}
