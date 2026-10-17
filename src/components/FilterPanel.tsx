import { useAuth } from '../auth'
import { useCafes } from '../data/cafes'
import type { Filters, Status } from '../roll'
import { WORK_LABELS, type WorkFlag } from '../types'
import { Stamp } from './Stamp'

type Props = { filters: Filters; onChange: (f: Filters) => void }

const STATUS: { value: Status; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'new', label: 'Want to try' },
  { value: 'been', label: 'Been' },
]

const PRICES = [
  { value: 0, label: 'Any' },
  { value: 1, label: '₱' },
  { value: 2, label: '₱₱ or less' },
  { value: 3, label: '₱₱₱ or less' },
]

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterPanel({ filters, onChange }: Props) {
  const { tags, areas } = useCafes()
  const { user } = useAuth()
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="filters">
      <fieldset>
        <legend>What are you craving?</legend>
        <div className="stamp-row">
          {tags.map((t) => (
            <Stamp key={t} label={t} pressed={filters.tags.includes(t)} onToggle={() => set({ tags: toggle(filters.tags, t) })} />
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Area</span>
        <select value={filters.area} onChange={(e) => set({ area: e.target.value })}>
          <option value="">Anywhere in Makati</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Been there?</legend>
        <div className="segmented">
          {STATUS.map((s) => (
            <button key={s.value} type="button" aria-pressed={filters.status === s.value} onClick={() => set({ status: s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Budget</legend>
        <div className="segmented">
          {PRICES.map((p) => (
            <button key={p.value} type="button" aria-pressed={filters.price === p.value} onClick={() => set({ price: p.value })}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Need to work?</legend>
        <div className="checks">
          {(Object.keys(WORK_LABELS) as WorkFlag[]).map((w) => (
            <label key={w} className="check">
              <input type="checkbox" checked={filters.work.includes(w)} onChange={() => set({ work: toggle(filters.work, w) })} />
              <span>{WORK_LABELS[w]}</span>
            </label>
          ))}
          {user && (
            <label className="check">
              <input type="checkbox" checked={filters.mine} onChange={(e) => set({ mine: e.target.checked })} />
              <span>Only places I've rated</span>
            </label>
          )}
        </div>
      </fieldset>
    </div>
  )
}
