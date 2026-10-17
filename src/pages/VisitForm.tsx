import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Slip } from '../components/Shell'
import { StarInput } from '../components/Stars'
import { useCafes } from '../data/cafes'
import { addVisit, itemMemory, updateVisit, useVisits } from '../data/visits'
import type { OrderItem, Visit } from '../types'

function today() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function VisitForm() {
  const { id = '', visitId } = useParams()
  const { loading: cafesLoading } = useCafes()
  const { visits, loading } = useVisits(id)
  // Wait for data so editing starts from the saved values.
  if (cafesLoading || (visitId && loading)) return <Slip><p className="muted">Loading…</p></Slip>
  return <VisitFormInner key={visitId ?? 'new'} cafeId={id} visitId={visitId} visits={visits} />
}

function VisitFormInner({ cafeId, visitId, visits }: { cafeId: string; visitId?: string; visits: Visit[] }) {
  const { byId } = useCafes()
  const { user, isMember, publicName } = useAuth()
  const navigate = useNavigate()
  const cafe = byId(cafeId)
  const existing = visitId ? visits.find((v) => v.id === visitId) : undefined

  const [date, setDate] = useState(() => existing?.date ?? today())
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [items, setItems] = useState<OrderItem[]>(() => (existing?.items.length ? existing.items : [{ name: '' }]))
  const [note, setNote] = useState(existing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestions = useMemo(() => itemMemory(visits), [visits])

  if (!isMember || !user) {
    return (
      <Slip>
        <p>Only invited members can log visits.</p>
        <Link to="/signin">Sign in</Link>
      </Slip>
    )
  }
  if (!cafe) return <Slip><p>That cafe isn't on file.</p></Slip>
  if (visitId && (!existing || existing.uid !== user.uid)) {
    return <Slip><p>You can only edit visits you logged.</p></Slip>
  }

  const setItem = (n: number, patch: Partial<OrderItem>) =>
    setItems((list) => list.map((it, i) => (i === n ? { ...it, ...patch } : it)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!rating) {
      setError('Give it a rating from 1 to 5 stars.')
      return
    }
    setSaving(true)
    setError(null)
    const input = { date, rating, items, note }
    try {
      if (existing) await updateVisit(cafe!.id, existing.id, input)
      else await addVisit(cafe!.id, input, user!.uid, publicName)
      navigate(`/cafe/${cafe!.id}`, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Slip>
      <form onSubmit={submit} className="form">
        <h1>{existing ? 'Edit visit' : 'Log a visit'}</h1>
        <p className="ticket-area">{cafe.name}, {cafe.area}</p>

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <fieldset>
          <legend>Overall</legend>
          <StarInput value={rating} onChange={setRating} label="Overall rating" />
        </fieldset>

        <fieldset>
          <legend>What you ordered</legend>
          <datalist id="item-options">
            {suggestions.map((s) => <option key={s.name} value={s.name} />)}
          </datalist>
          <ol className="order-items">
            {items.map((it, n) => (
              <li key={n} className="order-item">
                <div className="row">
                  <label className="field grow">
                    <span className="sr-only">Item {n + 1}</span>
                    <input
                      list="item-options"
                      value={it.name}
                      onChange={(e) => setItem(n, { name: e.target.value })}
                      placeholder={n === 0 ? 'e.g. Iced spanish latte' : 'Another item'}
                      autoComplete="off"
                    />
                  </label>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove item ${n + 1}`}
                      onClick={() => setItems((list) => list.filter((_, i) => i !== n))}
                    >
                      ×
                    </button>
                  )}
                </div>
                {it.name.trim() && (
                  <StarInput size="sm" value={it.rating ?? 0} onChange={(r) => setItem(n, { rating: r || undefined })} label={`Rating for ${it.name}`} allowClear />
                )}
              </li>
            ))}
          </ol>
          <button type="button" className="link-btn" onClick={() => setItems((list) => [...list, { name: '' }])}>
            Add another item
          </button>
        </fieldset>

        <label className="field">
          <span>Note <span className="muted">(optional)</span></span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Skip the croissant, ask for oat milk…" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button type="submit" className="btn btn-ink grow" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save visit' : 'Log visit'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </Slip>
  )
}
