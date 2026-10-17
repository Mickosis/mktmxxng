import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Slip } from '../components/Shell'
import { QuickAdd } from '../components/QuickAdd'
import { Stamp } from '../components/Stamp'
import { createCafe, updateCafe, useCafes } from '../data/cafes'
import { mergePrefill } from '../prefill/merge'
import type { Prefill } from '../prefill/parse'
import { isHttpUrl, linkLabel, mapsLink, WORK_LABELS, type CafeInput, type WorkFlag } from '../types'

const BLANK: CafeInput = {
  name: '',
  tags: [],
  area: '',
  address: '',
  mapsUrl: '',
  price: 0,
  notes: '',
  work: { wifi: false, outlets: false, laptop: false },
  links: [],
  petFriendly: false,
}

const PRICES = [
  { value: 0, label: 'Not sure' },
  { value: 1, label: '₱' },
  { value: 2, label: '₱₱' },
  { value: 3, label: '₱₱₱' },
]

export function CafeForm() {
  const { id } = useParams()
  const { loading } = useCafes()
  // Wait for the list so editing starts from the saved values.
  if (id && loading) return <Slip><p className="muted">Loading…</p></Slip>
  return <CafeFormInner key={id ?? 'new'} id={id} />
}

function CafeFormInner({ id }: { id?: string }) {
  const { byId, tags, areas, cafes } = useCafes()
  const { user, isMember } = useAuth()
  const navigate = useNavigate()
  const existing = id ? byId(id) : undefined

  const [form, setForm] = useState<CafeInput>(() =>
    existing
      ? {
          name: existing.name,
          tags: existing.tags,
          area: existing.area,
          address: existing.address,
          mapsUrl: existing.mapsUrl,
          price: existing.price,
          notes: existing.notes,
          work: { ...BLANK.work, ...existing.work },
          links: existing.links ?? [],
          petFriendly: existing.petFriendly ?? false,
        }
      : BLANK,
  )
  const [newTag, setNewTag] = useState('')
  const [newLink, setNewLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isMember || !user) {
    return (
      <Slip>
        <p>Only invited members can add or edit cafes.</p>
        <Link to="/signin">Sign in</Link>
      </Slip>
    )
  }
  if (id && !existing) {
    return (
      <Slip>
        <p>That cafe isn't on file.</p>
        <Link to="/list">Back to all cafes</Link>
      </Slip>
    )
  }

  const set = (patch: Partial<CafeInput>) => setForm((f) => ({ ...f, ...patch }))
  const allTags = [...new Set([...tags, ...form.tags])].sort()
  const duplicate = cafes.find((c) => c.id !== id && c.nameLower === form.name.trim().toLowerCase() && c.area === form.area.trim())

  function toggleTag(t: string) {
    set({ tags: form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t] })
  }

  function addTag() {
    const t = newTag.trim().toLowerCase()
    if (!t) return
    if (!form.tags.includes(t)) set({ tags: [...form.tags, t] })
    setNewTag('')
  }

  function addLink() {
    const url = newLink.trim()
    if (!isHttpUrl(url)) {
      setError('Paste the full link, starting with https://')
      return
    }
    setError(null)
    if (!form.links.includes(url)) set({ links: [...form.links, url].slice(0, 10) })
    setNewLink('')
  }

  function applyPrefill(p: Prefill): string[] {
    setForm((f) => mergePrefill(f, p).next)
    return mergePrefill(form, p).filled
  }

  function attachLink(url: string, replaces?: string) {
    setForm((f) => {
      const links = f.links.filter((l) => l !== replaces)
      return links.includes(url) || links.length >= 10 ? { ...f, links } : { ...f, links: [...links, url] }
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.area.trim()) {
      setError('Name and area are required.')
      return
    }
    // A pasted link that wasn't added yet still counts.
    const pending = newLink.trim()
    if (pending && !isHttpUrl(pending)) {
      setError('Paste the full link, starting with https://')
      return
    }
    // The Maps link is always built from name + address now.
    const input = { ...form, mapsUrl: '', links: pending ? [...form.links, pending] : form.links }
    setSaving(true)
    setError(null)
    try {
      const cafeId = existing ? (await updateCafe(existing.id, input), existing.id) : await createCafe(input, user!.uid)
      navigate(`/cafe/${cafeId}`, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Slip>
      <form onSubmit={submit} className="form">
        <h1>{existing ? `Edit ${existing.name}` : 'Add a cafe'}</h1>
        {!existing && <QuickAdd onPrefill={applyPrefill} onLink={attachLink} />}

        <label className="field">
          <span>Name</span>
          <input required value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
        </label>
        {duplicate && (
          <p className="warn">
            <Link to={`/cafe/${duplicate.id}`}>{duplicate.name}</Link> in {duplicate.area} is already on file.
          </p>
        )}

        <fieldset>
          <legend>Tags</legend>
          <div className="stamp-row">
            {allTags.map((t) => (
              <Stamp key={t} label={t} pressed={form.tags.includes(t)} onToggle={() => toggleTag(t)} />
            ))}
          </div>
          <div className="row">
            <label className="field grow">
              <span className="sr-only">New tag</span>
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="New tag, e.g. brunch"
              />
            </label>
            <button type="button" className="btn" onClick={addTag} disabled={!newTag.trim()}>Add tag</button>
          </div>
        </fieldset>

        <label className="field">
          <span>Area</span>
          <input
            required
            list="area-options"
            value={form.area}
            onChange={(e) => set({ area: e.target.value })}
            placeholder="e.g. Legazpi Village"
            autoComplete="off"
          />
          <datalist id="area-options">
            {areas.map((a) => <option key={a} value={a} />)}
          </datalist>
        </label>

        <fieldset>
          <legend>Social media and reels <span className="muted">(optional)</span></legend>
          {form.links.length > 0 && (
            <ul className="lines">
              {form.links.map((l) => (
                <li key={l} className="line">
                  <a className="line-name" href={l} target="_blank" rel="noreferrer">{linkLabel(l)}</a>
                  <span className="line-dots" aria-hidden="true" />
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`Remove ${linkLabel(l)} link`}
                    onClick={() => set({ links: form.links.filter((x) => x !== l) })}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {form.links.length < 10 && (
            <div className="row">
              <label className="field grow">
                <span className="sr-only">Link to a video or post</span>
                <input
                  type="url"
                  inputMode="url"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addLink()
                    }
                  }}
                  placeholder="Paste a TikTok or reel"
                  autoComplete="off"
                />
              </label>
              <button type="button" className="btn" onClick={addLink} disabled={!newLink.trim()}>Add link</button>
            </div>
          )}
        </fieldset>

        <label className="field">
          <span>Address <span className="muted">(optional)</span></span>
          <input value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, building" autoComplete="off" />
        </label>
        {form.name.trim() && (
          <p className="small muted">
            Open in Maps searches for this name and address in Makati.{' '}
            <a href={mapsLink({ name: form.name.trim(), address: form.address.trim(), area: form.area.trim(), mapsUrl: '' })} target="_blank" rel="noreferrer">
              Check it on Google Maps
            </a>
          </p>
        )}

        <fieldset>
          <legend>Price</legend>
          <div className="segmented">
            {PRICES.map((p) => (
              <button key={p.value} type="button" aria-pressed={form.price === p.value} onClick={() => set({ price: p.value })}>
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Good for working?</legend>
          <div className="checks">
            {(Object.keys(WORK_LABELS) as WorkFlag[]).map((w) => (
              <label key={w} className="check">
                <input type="checkbox" checked={form.work[w]} onChange={(e) => set({ work: { ...form.work, [w]: e.target.checked } })} />
                <span>{WORK_LABELS[w]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Pets</legend>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={form.petFriendly} onChange={(e) => set({ petFriendly: e.target.checked })} />
              <span>Pet-friendly</span>
            </label>
          </div>
        </fieldset>

        <label className="field">
          <span>Notes <span className="muted">(optional)</span></span>
          <textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Cash only, go before 10am…" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button type="submit" className="btn btn-ink grow" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add cafe'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </Slip>
  )
}
