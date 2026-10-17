import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ConfirmButton } from '../components/ConfirmButton'
import { Slip } from '../components/Shell'
import { SocialLinks } from '../components/SocialLinks'
import { Stamp } from '../components/Stamp'
import { Stars } from '../components/Stars'
import { deleteCafe, useCafes } from '../data/cafes'
import { deleteVisit, itemMemory, useVisits } from '../data/visits'
import { average, mapsLink, perks } from '../types'

const dateFmt = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
}

export function CafePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { byId, loading } = useCafes()
  const { user, isMember, isAdmin } = useAuth()
  const { visits } = useVisits(id)
  const [error, setError] = useState<string | null>(null)
  const cafe = byId(id)

  const items = useMemo(() => itemMemory(visits), [visits])
  const people = useMemo(() => {
    const map = new Map<string, { name: string; sum: number; n: number }>()
    for (const v of visits) {
      const p = map.get(v.uid) ?? { name: v.displayName, sum: 0, n: 0 }
      p.sum += v.rating
      p.n += 1
      map.set(v.uid, p)
    }
    return [...map.entries()].map(([uid, p]) => ({ uid, ...p })).sort((a, b) => b.n - a.n)
  }, [visits])

  if (!cafe) {
    return (
      <Slip>
        <p>{loading ? 'Loading…' : 'That cafe isn\'t on file. It may have been deleted.'}</p>
        <Link to="/list">Back to all cafes</Link>
      </Slip>
    )
  }

  const facts = perks(cafe)

  return (
    <>
      <Slip>
        <h1 className="display">{cafe.name}</h1>
        <p className="ticket-area">{cafe.area}{cafe.address ? `, ${cafe.address}` : ''}</p>
        {cafe.tags.length > 0 && (
          <div className="stamp-row">
            {cafe.tags.map((t) => <Stamp key={t} label={t} size="sm" />)}
          </div>
        )}
        {facts.length > 0 && <p className="ticket-sub">{facts.join('  ')}</p>}
        {cafe.notes && <p className="ticket-note">{cafe.notes}</p>}
        <SocialLinks links={cafe.links} />

        <hr className="rule" />
        <div className="line total">
          <span className="line-name">Total</span>
          <span className="line-dots" aria-hidden="true" />
          <span className="line-val"><Stars value={average(cafe)} count={cafe.visitCount || undefined} /></span>
        </div>
        {people.length > 0 && (
          <ul className="lines">
            {people.map((p) => (
              <li key={p.uid} className="line">
                <span className="line-name">{p.uid === user?.uid ? 'You' : p.name}</span>
                <span className="line-dots" aria-hidden="true" />
                <span className="line-val"><Stars value={p.sum / p.n} count={p.n} /></span>
              </li>
            ))}
          </ul>
        )}

        <div className="ticket-actions">
          <a className="btn" href={mapsLink(cafe)} target="_blank" rel="noreferrer">Open in Maps</a>
          {isMember && <Link className="btn btn-ink" to={`/cafe/${cafe.id}/visit`}>Log visit</Link>}
        </div>
      </Slip>

      {items.length > 0 && (
        <Slip>
          <h2>What people order</h2>
          <ul className="lines">
            {items.map((i) => (
              <li key={i.name} className="line">
                <span className="line-name">{i.name}</span>
                <span className="line-dots" aria-hidden="true" />
                <span className="line-val">
                  {i.avg != null && `★${i.avg.toFixed(1)} `}×{i.count}
                </span>
              </li>
            ))}
          </ul>
        </Slip>
      )}

      <Slip>
        <h2>Visits</h2>
        {visits.length === 0 ? (
          <p className="muted">No visits yet. {isMember ? 'Been here? Log it.' : ''}</p>
        ) : (
          <ol className="visits">
            {visits.map((v) => (
              <li key={v.id} className="visit">
                <div className="visit-head">
                  <span>{v.uid === user?.uid ? 'You' : v.displayName}</span>
                  <span className="muted">{formatDate(v.date)}</span>
                </div>
                <Stars value={v.rating} />
                {v.items?.length > 0 && (
                  <ul className="lines">
                    {v.items.map((i, n) => (
                      <li key={n} className="line">
                        <span className="line-name">{i.name}</span>
                        <span className="line-dots" aria-hidden="true" />
                        <span className="line-val">{i.rating ? `★${i.rating}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {v.note && <p className="ticket-note">{v.note}</p>}
                {v.uid === user?.uid && isMember && (
                  <div className="row">
                    <Link className="link-btn" to={`/cafe/${cafe.id}/visit/${v.id}`}>Edit</Link>
                    <ConfirmButton
                      confirmLabel="Tap again to delete"
                      onConfirm={() => deleteVisit(cafe.id, v.id).catch((e) => setError(e.message))}
                    >
                      Delete visit
                    </ConfirmButton>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Slip>

      {isMember && (
        <Slip>
          <div className="row">
            <Link className="btn" to={`/cafe/${cafe.id}/edit`}>Edit cafe</Link>
            {isAdmin && (
              <ConfirmButton
                confirmLabel="Tap again to delete"
                onConfirm={async () => {
                  try {
                    await deleteCafe(cafe.id)
                    navigate('/list')
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
              >
                Delete cafe
              </ConfirmButton>
            )}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </Slip>
      )}
    </>
  )
}
