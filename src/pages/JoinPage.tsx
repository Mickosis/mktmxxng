import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Slip } from '../components/Shell'
import { getInvite, PENDING_INVITE_KEY, redeemInvite, type Invite } from '../data/invites'
import { storage } from '../storage'
import { message, SignInOptions } from './SignInPage'

export function JoinPage() {
  const { token = '' } = useParams()
  const auth = useAuth()
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getInvite(token)
      .then((i) => live && setInvite(i))
      .catch(() => live && setInvite(null))
    return () => {
      live = false
    }
  }, [token])

  // Remember the invite so an email-link sign-in (which lands on the home page) can come back here.
  useEffect(() => {
    if (invite && !invite.usedBy) storage.set(PENDING_INVITE_KEY, token)
  }, [invite, token])

  const done = auth.isMember
  useEffect(() => {
    if (done) storage.remove(PENDING_INVITE_KEY)
  }, [done])

  async function join() {
    if (!auth.user?.email) return
    setBusy(true)
    setError(null)
    try {
      await redeemInvite(token, auth.user.uid, auth.user.email.toLowerCase(), auth.displayName)
    } catch (err) {
      setError(message(err) || 'Couldn\'t join with this link. It may have just been used.')
      setInvite(await getInvite(token).catch(() => null))
    } finally {
      setBusy(false)
    }
  }

  if (invite === undefined || auth.loading) return <Slip><p className="muted">Checking your invite…</p></Slip>

  if (auth.isMember) {
    return (
      <Slip>
        <h1 className="display">You're in</h1>
        <p>You can add cafes and log visits now.</p>
        <div className="row">
          <Link className="btn btn-ink" to="/add">Add a cafe</Link>
          <Link className="btn" to="/">Roll a cafe</Link>
        </div>
      </Slip>
    )
  }

  if (!invite) {
    return (
      <Slip>
        <h1>This invite link doesn't work</h1>
        <p>It may have been revoked, or the link got cut off when it was copied. Ask for a new one.</p>
        <Link to="/">Browse cafes anyway</Link>
      </Slip>
    )
  }

  if (invite.usedBy && invite.usedBy !== auth.user?.uid) {
    return (
      <Slip>
        <h1>This invite was already used</h1>
        <p>Each link lets one person join. Ask for a new one.</p>
        <Link to="/">Browse cafes anyway</Link>
      </Slip>
    )
  }

  return (
    <Slip>
      <h1 className="display">You're invited</h1>
      <p>Join MKTMXXNG to add Makati cafes, rate them, and log what you ordered.</p>
      <hr className="rule" />
      {auth.user ? (
        <>
          <p>Joining as <strong>{auth.user.email}</strong>.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-ink btn-block" disabled={busy} onClick={join}>
            {busy ? 'Joining…' : 'Join MKTMXXNG'}
          </button>
          <button className="link-btn" onClick={() => auth.signOut()}>Use a different account</button>
        </>
      ) : (
        <>
          <p className="muted">First, sign in. This link works once, for whoever uses it first.</p>
          <SignInOptions />
        </>
      )}
    </Slip>
  )
}
