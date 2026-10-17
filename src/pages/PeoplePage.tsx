import { collectionGroup, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Slip } from '../components/Shell'
import { Stars } from '../components/Stars'
import { useCafes } from '../data/cafes'
import { useProfiles } from '../data/profiles'
import { db } from '../firebase'
import type { Cafe, Visit } from '../types'

const dateFmt = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/** Visits and cafes added per person, from the counters already kept on each cafe. */
function tally(cafes: Cafe[], uid: string) {
  let visits = 0
  let places = 0
  let added = 0
  for (const c of cafes) {
    const n = c.raters?.[uid] ?? 0
    if (n > 0) {
      visits += n
      places += 1
    }
    if (c.createdBy === uid) added += 1
  }
  return { visits, places, added }
}

export function PeoplePage() {
  const { profiles } = useProfiles()
  const { cafes } = useCafes()
  const { user } = useAuth()

  return (
    <Slip>
      <h1>People</h1>
      {profiles.length === 0 ? (
        <p className="muted">No one has a name card yet.</p>
      ) : (
        <ul className="entries">
          {profiles.map((p) => {
            const t = tally(cafes, p.uid)
            return (
              <li key={p.uid}>
                <Link to={`/people/${p.uid}`} className="entry">
                  <span className="entry-top">
                    <span className="entry-name">{p.name}{p.uid === user?.uid ? ' (you)' : ''}</span>
                  </span>
                  <span className="entry-area">
                    {plural(t.visits, 'visit')} to {plural(t.places, 'place')}, added {plural(t.added, 'cafe')}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Slip>
  )
}

type Logged = Visit & { cafeId: string }

export function PersonPage() {
  const { uid = '' } = useParams()
  const { byUid } = useProfiles()
  const { cafes, byId } = useCafes()
  const { user } = useAuth()
  const [state, setState] = useState<{ uid: string; visits: Logged[] | null; error?: string } | null>(null)
  const profile = byUid(uid)
  const isMe = uid === user?.uid

  useEffect(() => {
    let live = true
    getDocs(query(collectionGroup(db, 'visits'), where('uid', '==', uid)))
      .then((snap) => {
        const visits = snap.docs
          .map((d) => ({ id: d.id, cafeId: d.ref.parent.parent!.id, ...d.data() }) as Logged)
          .sort((a, b) => b.date.localeCompare(a.date))
        if (live) setState({ uid, visits })
      })
      .catch((err) => live && setState({ uid, visits: [], error: (err as Error).message }))
    return () => {
      live = false
    }
  }, [uid])

  const current = state?.uid === uid ? state : null
  const added = useMemo(() => cafes.filter((c) => c.createdBy === uid).sort((a, b) => a.name.localeCompare(b.name)), [cafes, uid])
  const name = profile?.name ?? current?.visits?.[0]?.displayName ?? 'Someone'

  return (
    <>
      <Slip>
        <h1 className="display">{isMe ? `${name} (you)` : name}</h1>
        {isMe && !profile?.nameSet && (
          <p className="muted small">
            Others see your first name and last initial. <Link to="/signin">Pick the name you want shown</Link>.
          </p>
        )}
        <Link to="/people">Everyone</Link>
      </Slip>

      <Slip>
        <h2>Ratings</h2>
        {!current ? (
          <p className="muted">Loading…</p>
        ) : current.error ? (
          <p className="error">Couldn't load ratings: {current.error}</p>
        ) : current.visits!.length === 0 ? (
          <p className="muted">No visits logged yet.</p>
        ) : (
          <ol className="visits">
            {current.visits!.map((v) => {
              const cafe = byId(v.cafeId)
              return (
                <li key={`${v.cafeId}/${v.id}`} className="visit">
                  <div className="visit-head">
                    {cafe ? <Link to={`/cafe/${cafe.id}`}>{cafe.name}</Link> : <span className="muted">A deleted cafe</span>}
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
                </li>
              )
            })}
          </ol>
        )}
      </Slip>

      {added.length > 0 && (
        <Slip>
          <h2>Cafes added</h2>
          <ul className="lines">
            {added.map((c) => (
              <li key={c.id} className="line">
                <Link className="line-name" to={`/cafe/${c.id}`}>{c.name}</Link>
                <span className="line-dots" aria-hidden="true" />
                <span className="line-val">{c.area}</span>
              </li>
            ))}
          </ul>
        </Slip>
      )}
    </>
  )
}
