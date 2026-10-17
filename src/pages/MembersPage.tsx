import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ConfirmButton } from '../components/ConfirmButton'
import { Slip } from '../components/Shell'
import { createInvite, daysLeft, INVITE_DAYS, inviteUrl, isExpired, purgeStaleInvites, revokeInvite, useInvites, type Invite } from '../data/invites'
import { addMember, removeMember, useMembers } from '../data/members'
import type { Member } from '../types'

export function MembersPage() {
  const { isAdmin, user } = useAuth()
  const members = useMembers(isAdmin)
  const invites = useInvites(isAdmin)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Member['role']>('member')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  if (!isAdmin) {
    return (
      <Slip>
        <p>Only the admin manages members.</p>
        <Link to="/">Back to roll</Link>
      </Slip>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await addMember(email, role, name)
      setSaved(email.trim().toLowerCase())
      setEmail('')
      setName('')
      setRole('member')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const me = user?.email?.toLowerCase()

  return (
    <>
      <InviteLinks invites={invites} uid={user!.uid} />

      <Slip>
        <form className="form" onSubmit={submit}>
          <h2>Or add someone by email</h2>
          <p className="muted">They sign in with this email (Google or email link) and can then add cafes and log visits.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>Name shown on visits <span className="muted">(optional)</span></span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset>
            <legend>Role</legend>
            <div className="segmented">
              <button type="button" aria-pressed={role === 'member'} onClick={() => setRole('member')}>Member</button>
              <button type="button" aria-pressed={role === 'admin'} onClick={() => setRole('admin')}>Admin</button>
            </div>
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          {saved && <p className="ok" role="status">Invited {saved}.</p>}
          <button type="submit" className="btn btn-ink">Invite</button>
        </form>
      </Slip>

      <Slip>
        <h2>Members</h2>
        <ul className="lines">
          {members.map((m) => (
            <li key={m.email} className="member">
              <div>
                <p>{m.displayName || m.email.split('@')[0]}{m.email === me ? ' (you)' : ''}</p>
                <p className="muted small">{m.email}, {m.role}</p>
                {m.inviteLabel && <p className="muted small">Joined with invite "{m.inviteLabel}"</p>}
              </div>
              {m.email !== me && (
                <ConfirmButton confirmLabel="Tap again" onConfirm={() => removeMember(m.email).catch((e) => setError(e.message))}>
                  Remove
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      </Slip>
    </>
  )
}

function InviteLinks({ invites, uid }: { invites: Invite[]; uid: string }) {
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Clear out expired links whenever the admin opens this page.
  useEffect(() => {
    purgeStaleInvites(invites).catch(() => {})
  }, [invites])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const token = await createInvite(uid, label)
      setFresh(token)
      setLabel('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopied(token)
    } catch {
      setError('Couldn\'t copy. Long-press the link to copy it instead.')
    }
  }

  async function share(token: string) {
    try {
      await navigator.share({ title: 'Join MKTMXXNG', text: 'Join my Makati cafe list', url: inviteUrl(token) })
    } catch {
      /* share sheet dismissed */
    }
  }

  const open = invites.filter((i) => !isExpired(i))
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <Slip>
      <form className="form" onSubmit={create}>
        <h1>Invite a member</h1>
        <p className="muted">
          Make a link and send it in any chat. It works once and lasts {INVITE_DAYS} days. When someone joins with it, the link
          disappears from here and they show up under Members.
        </p>
        <label className="field">
          <span>Who's it for? <span className="muted">(optional, just for you)</span></span>
          <input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Ana" autoComplete="off" />
        </label>
        <button type="submit" className="btn btn-ink" disabled={busy}>{busy ? 'Making link…' : 'Create invite link'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      {open.length > 0 && (
        <>
          <hr className="rule" />
          <h2>Waiting to be used</h2>
          <ul className="lines">
            {open.map((i) => {
              const days = daysLeft(i)
              return (
                <li key={i.token} className={`invite${fresh === i.token ? ' invite-fresh' : ''}`}>
                  <div className="slip-head">
                    <p>{i.label || 'Invite link'}</p>
                    <span className="muted small">expires in {days} day{days === 1 ? '' : 's'}</span>
                  </div>
                  <input className="invite-url" readOnly value={inviteUrl(i.token)} onFocus={(e) => e.target.select()} aria-label="Invite link" />
                  <div className="row">
                    <button type="button" className="btn" onClick={() => copy(i.token)}>{copied === i.token ? 'Copied' : 'Copy link'}</button>
                    {canShare && <button type="button" className="btn" onClick={() => share(i.token)}>Share</button>}
                    <ConfirmButton confirmLabel="Tap again" onConfirm={() => revokeInvite(i.token).catch((e) => setError(e.message))}>
                      Revoke
                    </ConfirmButton>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Slip>
  )
}
