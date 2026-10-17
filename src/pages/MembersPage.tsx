import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ConfirmButton } from '../components/ConfirmButton'
import { Slip } from '../components/Shell'
import { addMember, removeMember, useMembers } from '../data/members'
import type { Member } from '../types'

export function MembersPage() {
  const { isAdmin, user } = useAuth()
  const members = useMembers(isAdmin)
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
      <Slip>
        <form className="form" onSubmit={submit}>
          <h1>Invite a member</h1>
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
