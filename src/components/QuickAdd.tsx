import { useState, type ClipboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCafes } from '../data/cafes'
import { nameFromHandle, parseCaption, profileName, type Prefill } from '../prefill/parse'
import { cleanLink, fetchPreview, findUrl, handleOf, isProfile, platformOf, PLATFORM_NAMES, sameLink, type Preview } from '../prefill/preview'
import type { Cafe } from '../types'

type Props = {
  /** Merge what the caption says into the form; returns what got filled. */
  onPrefill: (p: Prefill) => string[]
  /** Add a link to the form, optionally replacing an earlier one (a short link once it's resolved). */
  onLink: (url: string, replaces?: string) => void
}

type State =
  | { step: 'idle' }
  | { step: 'reading'; url: string }
  | { step: 'done'; preview: Preview | null; filled: string[]; mentions: string[] }
  | { step: 'caption'; url: string; filled: string[] }
  | { step: 'duplicate'; cafe: Cafe; url: string }
  | { step: 'error'; message: string }

function listOf(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "Start from a link": paste a TikTok/IG/FB post or profile link (or its caption) and pre-fill the form. */
export function QuickAdd({ onPrefill, onLink }: Props) {
  const { cafes, tags, areas } = useCafes()
  const [state, setState] = useState<State>({ step: 'idle' })
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')

  function fromCaption(source: string, preview: Preview | null) {
    const parsed = parseCaption(source, { tags, areas, author: preview?.author ?? undefined })
    // On a profile the account's own name is the best guess for the cafe's.
    if (preview?.kind === 'profile' && preview.name) parsed.name = profileName(preview.name) ?? parsed.name
    const filled = onPrefill(parsed)
    setState({ step: 'done', preview, filled, mentions: parsed.mentions })
  }

  async function handle(raw: string) {
    const input = raw.trim()
    if (!input) return
    const found = findUrl(input)
    const url = found && cleanLink(found)
    if (!url) {
      // No link: treat it as a pasted caption.
      fromCaption(input, null)
      return
    }
    if (!platformOf(url)) {
      setState({ step: 'error', message: 'That link isn\'t from TikTok, Instagram or Facebook. Add it under Social media below instead.' })
      return
    }
    const dupe = cafes.find((c) => c.links?.some((l) => sameLink(l, url)))
    if (dupe) {
      setState({ step: 'duplicate', cafe: dupe, url })
      return
    }
    onLink(url)
    setState({ step: 'reading', url })
    const preview = await fetchPreview(url)
    if (preview?.caption || preview?.name) {
      if (!sameLink(preview.url, url)) onLink(cleanLink(preview.url), url)
      fromCaption(preview.caption ?? '', preview)
    } else {
      // Instagram hides profiles from servers; the handle is still a decent guess at the name.
      const handle = handleOf(url)
      let filled: string[] = []
      if (handle) {
        const parsed = parseCaption(handle.replace(/[._-]+/g, ' '), { tags, areas })
        parsed.name = nameFromHandle(handle)
        filled = onPrefill(parsed)
      }
      setState({ step: 'caption', url, filled })
    }
  }

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText()
      setText(clip)
      await handle(clip)
    } catch {
      setState({ step: 'error', message: 'Your browser blocked reading the clipboard. Long-press the box and tap Paste.' })
    }
  }

  function onPasteText(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text')
    if (pasted) {
      e.preventDefault()
      setText(pasted)
      void handle(pasted)
    }
  }

  const platform = state.step === 'caption' ? platformOf(state.url) : null
  const profile = state.step === 'caption' && isProfile(state.url)
  const source = state.step === 'done' && state.preview?.kind === 'profile' ? 'profile' : 'caption'
  // Facebook pages have no @handle, so fall back to the page name.
  const credit = state.step === 'done' ? (state.preview?.author ?? state.preview?.name) : null

  return (
    <section className="quick-add" aria-labelledby="quick-add-title">
      <h2 id="quick-add-title">Start from a link</h2>
      <p className="muted small">Copy a link to a TikTok, Instagram or Facebook post or profile, then tap Paste. We'll fill in what the caption or bio says.</p>
      <div className="row">
        <button type="button" className="btn btn-ink" onClick={pasteFromClipboard} disabled={state.step === 'reading'}>
          Paste link
        </button>
        <label className="field grow">
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
            onBlur={() => state.step === 'idle' && text.trim() && void handle(text)}
            placeholder="or paste it here"
            inputMode="url"
            autoComplete="off"
          />
        </label>
      </div>

      <div aria-live="polite">
        {state.step === 'reading' && <p className="quick-status printing">{isProfile(state.url) ? 'Reading the profile' : 'Reading the post'}</p>}

        {state.step === 'done' && (
          <div className="quick-status">
            {state.preview?.thumbnail && <img className="quick-thumb" src={state.preview.thumbnail} alt="" referrerPolicy="no-referrer" />}
            <div>
              {state.filled.length ? (
                <p>
                  Filled in {listOf(state.filled)}
                  {credit ? ` from ${credit}'s ${source}` : ` from the ${source}`}. Check the details below.
                </p>
              ) : (
                <p>The {source} didn't name the place. Fill in the details below; the link is saved.</p>
              )}
              {state.mentions.length > 0 && (
                <p className="muted small">Mentioned: {state.mentions.map((m) => `@${m}`).join('  ')}</p>
              )}
            </div>
          </div>
        )}

        {state.step === 'caption' && (
          <div className="quick-status quick-caption">
            <p>
              {platform === 'tiktok'
                ? `Couldn't read this TikTok ${profile ? 'profile' : 'post'} right now.`
                : `${platform ? PLATFORM_NAMES[platform] : 'This site'} didn't share this ${profile ? 'profile' : 'post'} with other apps.`}{' '}
              {state.filled.length > 0 && `Filled in ${listOf(state.filled)} from the handle. `}
              The link is saved. Copy the {profile ? 'bio' : 'caption'} and paste it here to fill in the rest.
            </p>
            <label className="field">
              <span className="sr-only">Caption</span>
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  if (pasted) {
                    e.preventDefault()
                    setCaption(pasted)
                    fromCaption(pasted, null)
                  }
                }}
                placeholder={profile ? 'Paste the bio' : 'Paste the caption'}
              />
            </label>
            <button type="button" className="btn" disabled={!caption.trim()} onClick={() => fromCaption(caption, null)}>
              Fill in from {profile ? 'bio' : 'caption'}
            </button>
          </div>
        )}

        {state.step === 'duplicate' && (
          <p className="quick-status warn">
            This {isProfile(state.url) ? 'profile' : 'post'} is already on file under <Link to={`/cafe/${state.cafe.id}`}>{state.cafe.name}</Link>.
          </p>
        )}

        {state.step === 'error' && <p className="quick-status error">{state.message}</p>}
      </div>
    </section>
  )
}
