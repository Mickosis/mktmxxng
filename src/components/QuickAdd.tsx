import { useState, type ClipboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCafes } from '../data/cafes'
import { parseCaption, type Prefill } from '../prefill/parse'
import { cleanLink, fetchPreview, findUrl, platformOf, PLATFORM_NAMES, sameLink, type Preview } from '../prefill/preview'
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
  | { step: 'caption'; url: string }
  | { step: 'duplicate'; cafe: Cafe }
  | { step: 'error'; message: string }

function listOf(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "Start from a post": paste a TikTok/IG/FB link (or its caption) and pre-fill the form. */
export function QuickAdd({ onPrefill, onLink }: Props) {
  const { cafes, tags, areas } = useCafes()
  const [state, setState] = useState<State>({ step: 'idle' })
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')

  function fromCaption(source: string, preview: Preview | null) {
    const parsed = parseCaption(source, { tags, areas, author: preview?.author ?? undefined })
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
      setState({ step: 'duplicate', cafe: dupe })
      return
    }
    onLink(url)
    setState({ step: 'reading', url })
    const preview = await fetchPreview(url)
    if (preview?.caption) {
      if (!sameLink(preview.url, url)) onLink(cleanLink(preview.url), url)
      fromCaption(preview.caption, preview)
    } else {
      setState({ step: 'caption', url })
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

  return (
    <section className="quick-add" aria-labelledby="quick-add-title">
      <h2 id="quick-add-title">Start from a post</h2>
      <p className="muted small">Copy a TikTok, Instagram or Facebook link, then tap Paste. We'll fill in what the caption says.</p>
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
        {state.step === 'reading' && <p className="quick-status printing">Reading the post</p>}

        {state.step === 'done' && (
          <div className="quick-status">
            {state.preview?.thumbnail && <img className="quick-thumb" src={state.preview.thumbnail} alt="" referrerPolicy="no-referrer" />}
            <div>
              {state.filled.length ? (
                <p>
                  Filled in {listOf(state.filled)}
                  {state.preview?.author ? ` from ${state.preview.author}'s caption` : ' from the caption'}. Check the details below.
                </p>
              ) : (
                <p>The caption didn't name the place. Fill in the details below; the link is saved.</p>
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
                ? 'Couldn\'t read this TikTok right now.'
                : `${platform ? PLATFORM_NAMES[platform] : 'This site'} doesn't share captions with other apps.`}{' '}
              The link is saved. Copy the caption and paste it here to fill in the rest.
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
                placeholder="Paste the caption"
              />
            </label>
            <button type="button" className="btn" disabled={!caption.trim()} onClick={() => fromCaption(caption, null)}>
              Fill in from caption
            </button>
          </div>
        )}

        {state.step === 'duplicate' && (
          <p className="quick-status warn">
            This post is already on file under <Link to={`/cafe/${state.cafe.id}`}>{state.cafe.name}</Link>.
          </p>
        )}

        {state.step === 'error' && <p className="quick-status error">{state.message}</p>}
      </div>
    </section>
  )
}
