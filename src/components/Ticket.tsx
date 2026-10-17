import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { itemMemory, useVisits } from '../data/visits'
import { average, mapsLink, perks, type Cafe } from '../types'
import { SocialLinks } from './SocialLinks'
import { Stamp } from './Stamp'
import { Stars } from './Stars'

type Props = { cafe: Cafe; orderNo: number; printedAt: Date }

const dateFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false })

export function Ticket({ cafe, orderNo, printedAt }: Props) {
  const { isMember } = useAuth()
  const { visits } = useVisits(cafe.id)
  const usual = itemMemory(visits).slice(0, 4)
  const avg = average(cafe)
  const facts = perks(cafe)

  return (
    <article className="ticket" aria-live="polite" aria-label={`Your pick: ${cafe.name}`}>
      <header className="ticket-head">
        <p className="ticket-brand">MKTMXXNG</p>
        <p>MAKATI CITY</p>
        <p className="ticket-meta">
          <span>{dateFmt.format(printedAt)}</span>
          <span>{timeFmt.format(printedAt)}</span>
        </p>
        <p className="ticket-meta">
          <span>Order no.</span>
          <span>{String(orderNo).padStart(4, '0')}</span>
        </p>
      </header>

      <hr className="rule" />

      <h2 className="ticket-name">
        <Link to={`/cafe/${cafe.id}`}>{cafe.name}</Link>
      </h2>
      <p className="ticket-area">{cafe.area}{cafe.address ? `, ${cafe.address}` : ''}</p>
      {cafe.tags.length > 0 && (
        <div className="stamp-row">
          {cafe.tags.map((t) => <Stamp key={t} label={t} size="sm" />)}
        </div>
      )}

      {usual.length > 0 && (
        <>
          <hr className="rule" />
          <p className="ticket-section">Usual orders</p>
          <ul className="lines">
            {usual.map((i) => (
              <li key={i.name} className="line">
                <span className="line-name">{i.name}</span>
                <span className="line-dots" aria-hidden="true" />
                <span className="line-val">{i.avg != null ? `★${i.avg.toFixed(1)}` : `×${i.count}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <hr className="rule" />
      <div className="line total">
        <span className="line-name">Total</span>
        <span className="line-dots" aria-hidden="true" />
        <span className="line-val"><Stars value={avg} /></span>
      </div>
      <p className="ticket-sub">
        {cafe.visitCount > 0 ? `${cafe.visitCount} visit${cafe.visitCount === 1 ? '' : 's'} logged` : 'Want to try. Nobody has been yet.'}
      </p>
      {facts.length > 0 && <p className="ticket-sub">{facts.join('  ')}</p>}
      {cafe.notes && <p className="ticket-note">{cafe.notes}</p>}
      <SocialLinks links={cafe.links} />

      <hr className="rule" />
      <div className="ticket-actions">
        <a className="btn" href={mapsLink(cafe)} target="_blank" rel="noreferrer">Open in Maps</a>
        {isMember && <Link className="btn" to={`/cafe/${cafe.id}/visit`}>Log visit</Link>}
      </div>
    </article>
  )
}
