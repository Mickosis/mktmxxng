import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { FilterPanel } from '../components/FilterPanel'
import { Slip } from '../components/Shell'
import { Stamp } from '../components/Stamp'
import { Stars } from '../components/Stars'
import { useCafes } from '../data/cafes'
import { activeFilterCount, EMPTY_FILTERS, matches, type Filters } from '../roll'
import { storage } from '../storage'
import { average, pesos, type Cafe } from '../types'

type Sort = 'score' | 'name' | 'recent'

const SORTS: Record<Sort, (a: Cafe, b: Cafe) => number> = {
  score: (a, b) => (average(b) ?? -1) - (average(a) ?? -1) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  recent: (a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0),
}

export function ListPage() {
  const { cafes, loading, error } = useCafes()
  const { user, isMember } = useAuth()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>(() => (storage.get('mk.listSort') as Sort) || 'score')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const count = activeFilterCount(filters)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cafes
      .filter((c) => matches(c, filters, user?.uid))
      .filter((c) => !q || c.nameLower.includes(q) || c.area.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q)))
      .sort(SORTS[sort])
  }, [cafes, filters, search, sort, user?.uid])

  return (
    <Slip>
      <div className="slip-head">
        <h1>All cafes</h1>
        <span className="muted">{shown.length} of {cafes.length}</span>
      </div>

      <label className="field">
        <span>Search</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, area or tag" />
      </label>

      <div className="row">
        <label className="field grow">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort)
              storage.set('mk.listSort', e.target.value)
            }}
          >
            <option value="score">Highest rated</option>
            <option value="name">Name</option>
            <option value="recent">Recently updated</option>
          </select>
        </label>
      </div>

      <details className="disclosure">
        <summary>Filters{count > 0 ? ` (${count} on)` : ''}</summary>
        <FilterPanel filters={filters} onChange={setFilters} />
        {count > 0 && (
          <button type="button" className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
        )}
      </details>

      <hr className="rule" />

      {loading ? (
        <p className="muted">Loading the cafe list…</p>
      ) : error ? (
        <p className="error">Couldn't load cafes: {error}</p>
      ) : shown.length === 0 ? (
        <p>
          {cafes.length === 0
            ? isMember ? <>Nothing here yet. <Link to="/add">Add the first cafe</Link>.</> : 'Nothing here yet.'
            : 'No cafes match. Try a shorter search or fewer filters.'}
        </p>
      ) : (
        <ul className="entries">
          {shown.map((c) => (
            <li key={c.id}>
              <Link to={`/cafe/${c.id}`} className="entry">
                <span className="entry-top">
                  <span className="entry-name">{c.name}</span>
                  <span className="entry-price">{pesos(c.price)}</span>
                </span>
                <span className="entry-area">{c.area}</span>
                <span className="entry-bottom">
                  <span className="stamp-row">
                    {c.tags.map((t) => <Stamp key={t} label={t} size="sm" />)}
                  </span>
                  {c.visitCount > 0 ? <Stars value={average(c)} count={c.visitCount} /> : <span className="muted">want to try</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Slip>
  )
}
