import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { FilterPanel } from '../components/FilterPanel'
import { Slip } from '../components/Shell'
import { Ticket } from '../components/Ticket'
import { useCafes } from '../data/cafes'
import { activeFilterCount, EMPTY_FILTERS, matches, pick, type Filters } from '../roll'
import { storage } from '../storage'
import type { Cafe } from '../types'

const FILTERS_KEY = 'mk.rollFilters'

export function RollPage() {
  const { cafes, loading, error } = useCafes()
  const { user, isMember } = useAuth()
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...storage.getJSON(FILTERS_KEY, {}) }))
  const [result, setResult] = useState<{ cafe: Cafe; orderNo: number; at: Date } | null>(null)
  const [missed, setMissed] = useState(false)
  const printer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    storage.setJSON(FILTERS_KEY, filters)
  }, [filters])

  const candidates = useMemo(() => cafes.filter((c) => matches(c, filters, user?.uid)), [cafes, filters, user?.uid])
  // Keep the printed ticket in sync with live edits to that cafe.
  const live = result ? cafes.find((c) => c.id === result.cafe.id) ?? result.cafe : null

  function print() {
    const cafe = pick(candidates)
    if (!cafe) {
      setResult(null)
      setMissed(true)
      return
    }
    setMissed(false)
    setResult((prev) => ({ cafe, orderNo: (prev?.orderNo ?? 0) + 1, at: new Date() }))
    printer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const count = activeFilterCount(filters)

  return (
    <>
      <div className="printer" ref={printer}>
        <div className="printer-slot" aria-hidden="true" />
        <div className="printer-out">
          {live && result ? (
            <div className="feed" key={result.orderNo}>
              <Slip className="slip-ticket">
                <Ticket cafe={live} orderNo={result.orderNo} printedAt={result.at} />
              </Slip>
            </div>
          ) : (
            <Slip className="slip-idle">
              {loading ? (
                <p className="muted">Loading the cafe list…</p>
              ) : error ? (
                <p className="error">Couldn't load cafes: {error}</p>
              ) : cafes.length === 0 ? (
                <>
                  <h1 className="display">No cafes on file yet</h1>
                  <p>
                    {isMember ? (
                      <>Add the first one and it'll show up here. <Link to="/add">Add a cafe</Link></>
                    ) : (
                      <>Members add cafes. <Link to="/signin">Sign in</Link> if you've been invited.</>
                    )}
                  </p>
                </>
              ) : missed ? (
                <>
                  <h1 className="display">Nothing matches</h1>
                  <p>No cafe fits all {count} filter{count === 1 ? '' : 's'}. Loosen one and print again.</p>
                </>
              ) : (
                <>
                  <h1 className="display">Where to?</h1>
                  <p>Pick what you're craving and where, then print a random cafe from the list.</p>
                </>
              )}
            </Slip>
          )}
        </div>
      </div>

      <Slip>
        <div className="slip-head">
          <h2>Your order</h2>
          {count > 0 && (
            <button type="button" className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
        <FilterPanel filters={filters} onChange={setFilters} />
      </Slip>

      <div className="print-bar">
        <button type="button" className="btn btn-print" onClick={print} disabled={loading || cafes.length === 0}>
          <span>{result ? 'Reroll' : 'Print a pick'}</span>
          <span className="print-count">{candidates.length} match</span>
        </button>
      </div>
    </>
  )
}
