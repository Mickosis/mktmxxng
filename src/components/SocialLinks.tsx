import { linkLabel } from '../types'

/** TikToks, reels and posts about a cafe, printed as line items. */
export function SocialLinks({ links }: { links?: string[] }) {
  if (!links?.length) return null
  return (
    <ul className="lines">
      {links.map((url) => (
        <li key={url}>
          <a className="line social-link" href={url} target="_blank" rel="noreferrer">
            <span className="line-name">{linkLabel(url)}</span>
            <span className="line-dots" aria-hidden="true" />
            <span className="line-val">Watch</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
