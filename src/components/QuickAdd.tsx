import { useRef, useState, type ClipboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCafes } from '../data/cafes'
import type { Filled } from '../prefill/merge'
import { nameFromHandle, parseCaption, profileName, type Prefill } from '../prefill/parse'
import { cleanLink, fetchPreview, findUrl, handleOf, isProfile, platformOf, PLATFORM_NAMES, sameLink, type Preview } from '../prefill/preview'
import { cleanMapsLink, fetchPlace, isMapsLink, isShortMapsLink, placeFromShareText, placeIdOf, placePrefill } from '../prefill/maps'
import type { Cafe } from '../types'

type Props = {
  /** Merge what the caption says into the form; returns what got filled. */
  onPrefill: (p: Prefill) => Filled[]
  /** Add a link to the form, optionally replacing an earlier one (a short link once it's resolved). */
  onLink: (url: string, replaces?: string) => void
  /** Pin the cafe to a pasted Google/Apple Maps link. */
  onMapsUrl: (url: string) => void
}

/** One pasted link (or caption) and what came of it, printed as a line on the panel's receipt. */
type Entry = {
  key: number
  kind: 'post' | 'profile' | 'place' | 'caption'
  /** The link as pasted; empty for a pasted caption. */
  url: string
  status: 'reading' | 'filled' | 'needs-caption' | 'duplicate' | 'error'
  filled: Filled[]
  /** Whose post or profile it was: @handle, or a page name for Facebook. */
  credit?: string | null
  thumbnail?: string | null
  mentions?: string[]
  cafe?: Cafe
  message?: string
}

/** Maps links differ only in tracking params (g_st, entry, g_ep…) for the same pin. */
function sameMapsLink(a: string, b: string) {
  const norm = (u: string) => {
    try {
      const x = new URL(u)
      const q = x.searchParams.get('q') ?? x.searchParams.get('query') ?? ''
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}?${q}`.toLowerCase()
    } catch {
      return u
    }
  }
  return norm(a) === norm(b)
}

function title(e: Entry): string {
  if (e.kind === 'place') return 'Maps pin'
  if (e.kind === 'caption') return 'Pasted caption'
  const platform = platformOf(e.url)
  const what = `${platform ? PLATFORM_NAMES[platform] : 'Link'} ${e.kind}`
  return e.credit ? `${what} by ${e.credit}` : what
}

function tally(e: Entry): string {
  switch (e.status) {
    case 'reading':
      return 'reading'
    case 'filled':
      return e.filled.length ? `${e.filled.length} filled` : 'nothing new'
    case 'needs-caption':
      return 'needs caption'
    case 'duplicate':
      return 'on file'
    case 'error':
      return 'skipped'
  }
}

/** "Start from a link": paste TikTok/IG/FB posts or profiles, Maps links or captions, and pre-fill the form. */
export function QuickAdd({ onPrefill, onLink, onMapsUrl }: Props) {
  const { cafes, tags, areas } = useCafes()
  const [entries, setEntries] = useState<Entry[]>([])
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')
  const nextKey = useRef(0)

  function start(kind: Entry['kind'], url: string, patch: Partial<Entry> = {}): number {
    const key = nextKey.current++
    setEntries((es) => [...es, { key, kind, url, status: 'reading', filled: [], ...patch }])
    return key
  }

  function update(key: number, patch: Partial<Entry>) {
    setEntries((es) => es.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  function fromCaption(key: number, source: string, preview: Preview | null) {
    const parsed = parseCaption(source, { tags, areas, author: preview?.author ?? undefined })
    // On a profile the account's own name is the best guess for the cafe's.
    if (preview?.kind === 'profile' && preview.name) parsed.name = profileName(preview.name) ?? parsed.name
    const filled = onPrefill(parsed)
    // Facebook pages have no @handle, so fall back to the page name.
    const from = preview ? { credit: preview.author ?? preview.name, thumbnail: preview.thumbnail } : {}
    update(key, { status: 'filled', filled, mentions: parsed.mentions, ...from })
  }

  async function fromMaps(link: string, input: string) {
    const url = cleanMapsLink(link)
    const dupe = cafes.find((c) => c.mapsUrl && sameMapsLink(c.mapsUrl, url))
    if (dupe) {
      start('place', url, { status: 'duplicate', cafe: dupe })
      return
    }
    const key = start('place', url)
    const place = await fetchPlace(url)
    // Every share makes a new short link, so match on the place behind it.
    const id = place && placeIdOf(place.url)
    const same = id ? await findByPlaceId(id) : undefined
    if (same) {
      update(key, { status: 'duplicate', cafe: same })
      return
    }
    // Keep the full link: it carries the place id, so later shares of the same place are caught.
    onMapsUrl(id ? cleanMapsLink(place.url) : url)
    update(key, { status: 'filled', filled: onPrefill(placePrefill(url, place, { tags, areas }, placeFromShareText(input, link))) })
  }

  /** The cafe pinned to this Google place, resolving any older short links on file (the helper caches them). */
  async function findByPlaceId(id: string): Promise<Cafe | undefined> {
    const direct = cafes.find((c) => c.mapsUrl && placeIdOf(c.mapsUrl) === id)
    if (direct) return direct
    const short = cafes.filter((c) => c.mapsUrl && isShortMapsLink(c.mapsUrl))
    const resolved = await Promise.all(short.map((c) => fetchPlace(c.mapsUrl)))
    return short.find((_, i) => {
      const r = resolved[i]
      return r ? placeIdOf(r.url) === id : false
    })
  }

  async function handle(raw: string) {
    const input = raw.trim()
    if (!input) return
    // Clear the box so the next link goes into an empty one; the receipt below keeps the record.
    setText('')
    const found = findUrl(input)
    const url = found && cleanLink(found)
    if (!url) {
      // No link: treat it as a pasted caption.
      fromCaption(start('caption', ''), input, null)
      return
    }
    if (isMapsLink(found)) {
      await fromMaps(found, input)
      return
    }
    const kind = isProfile(url) ? 'profile' : 'post'
    if (!platformOf(url)) {
      start(kind, url, { status: 'error', message: "That link isn't from TikTok, Instagram, Facebook or Maps. Add it under Social media below instead." })
      return
    }
    const dupe = cafes.find((c) => c.links?.some((l) => sameLink(l, url)))
    if (dupe) {
      start(kind, url, { status: 'duplicate', cafe: dupe })
      return
    }
    onLink(url)
    const key = start(kind, url)
    const preview = await fetchPreview(url)
    if (preview?.caption || preview?.name) {
      if (!sameLink(preview.url, url)) onLink(cleanLink(preview.url), url)
      fromCaption(key, preview.caption ?? '', preview)
    } else {
      // Instagram hides profiles from servers; the handle is still a decent guess at the name.
      const handle = handleOf(url)
      let filled: Filled[] = []
      if (handle) {
        const parsed = parseCaption(handle.replace(/[._-]+/g, ' '), { tags, areas })
        parsed.name = nameFromHandle(handle)
        filled = onPrefill(parsed)
      }
      update(key, { status: 'needs-caption', filled, credit: handle ? `@${handle}` : null })
    }
  }

  async function pasteFromClipboard() {
    try {
      await handle(await navigator.clipboard.readText())
    } catch {
      start('caption', '', { status: 'error', message: 'Your browser blocked reading the clipboard. Long-press the box above and tap Paste.' })
    }
  }

  function onPasteText(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text')
    if (pasted) {
      e.preventDefault()
      void handle(pasted)
    }
  }

  const reading = entries.some((e) => e.status === 'reading')
  const done = entries.filter((e) => e.status === 'filled' || e.status === 'needs-caption')
  const hasPlace = done.some((e) => e.kind === 'place')
  const hasPost = done.some((e) => e.kind !== 'place')
  // A post gives the vibe and tags, a Maps pin the exact place; nudge toward whichever is missing.
  const nudge = reading || !done.length
    ? null
    : !hasPlace
      ? 'For the exact area and address, paste the Google Maps link too.'
      : !hasPost
        ? 'For tags and what to order, paste a TikTok, Instagram or Facebook link too.'
        : null

  return (
    <section className="quick-add" aria-labelledby="quick-add-title">
      <div>
        <h2 id="quick-add-title">Start from a link</h2>
        <p className="muted small">Copy a TikTok, Instagram, Facebook or Google Maps link, then tap Paste.</p>
      </div>
      <button type="button" className="btn btn-ink quick-paste" onClick={pasteFromClipboard} disabled={reading}>
        {entries.length ? 'Paste another link' : 'Paste link'}
      </button>
      <label className="field">
        <span className="sr-only">Link or caption</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPasteText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handle(text)
            }
          }}
          onBlur={() => text.trim() && void handle(text)}
          placeholder="or type a link or caption here"
          inputMode="url"
          autoComplete="off"
        />
      </label>

      {entries.length > 0 && (
        <ol className="quick-log" aria-live="polite">
          {entries.map((e) => (
            <li key={e.key} className={`quick-entry ${e.status}`}>
              <div className="line">
                <span className="line-name">{title(e)}</span>
                <span className="line-dots" aria-hidden="true" />
                <span className={`line-val${e.status === 'reading' ? ' printing' : ''}`}>{tally(e)}</span>
              </div>

              {e.status === 'filled' && e.filled.length > 0 && (
                <div className="quick-filled">
                  {e.thumbnail && <img className="quick-thumb" src={e.thumbnail} alt="" referrerPolicy="no-referrer" />}
                  <dl>
                    {e.filled.map((f) => (
                      <div key={f.field}>
                        <dt>{f.field}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {e.status === 'filled' && !e.filled.length && (
                <p className="muted small">
                  {e.kind === 'place' ? 'Pinned. Everything it knew was already filled in.' : 'Nothing new in it; the link is saved.'}
                </p>
              )}
              {e.mentions && e.mentions.length > 0 && (
                <p className="muted small">Mentioned: {e.mentions.map((m) => `@${m}`).join(', ')}</p>
              )}

              {e.status === 'needs-caption' && (
                <div className="quick-caption">
                  {e.filled.length > 0 && <p className="muted small">Guessed {e.filled.map((f) => f.field.toLowerCase()).join(' and ')} from the handle.</p>}
                  <p className="small">
                    {platformOf(e.url) === 'tiktok' ? "TikTok didn't answer just now." : `${PLATFORM_NAMES[platformOf(e.url)!]} keeps this ${e.kind} private from other apps.`}{' '}
                    The link is saved. Copy the {e.kind === 'profile' ? 'bio' : 'caption'} and paste it here for the rest.
                  </p>
                  <label className="field">
                    <span className="sr-only">{e.kind === 'profile' ? 'Bio' : 'Caption'}</span>
                    <textarea
                      rows={3}
                      value={caption}
                      onChange={(ev) => setCaption(ev.target.value)}
                      onPaste={(ev) => {
                        const pasted = ev.clipboardData.getData('text')
                        if (pasted) {
                          ev.preventDefault()
                          setCaption('')
                          fromCaption(e.key, pasted, null)
                        }
                      }}
                      placeholder={e.kind === 'profile' ? 'Paste the bio' : 'Paste the caption'}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={!caption.trim()}
                    onClick={() => {
                      fromCaption(e.key, caption, null)
                      setCaption('')
                    }}
                  >
                    Fill in from {e.kind === 'profile' ? 'bio' : 'caption'}
                  </button>
                </div>
              )}

              {e.status === 'duplicate' && e.cafe && (
                <p className="warn small">
                  Already on file as <Link to={`/cafe/${e.cafe.id}`}>{e.cafe.name}</Link>.
                </p>
              )}
              {e.status === 'error' && <p className="error small">{e.message}</p>}
            </li>
          ))}
        </ol>
      )}

      {nudge && <p className="quick-nudge small">{nudge}</p>}
    </section>
  )
}
