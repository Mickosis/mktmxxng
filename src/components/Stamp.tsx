import type { CSSProperties, ReactNode } from 'react'

// Deterministic tilt per label so a stamp always lands the same way.
function tilt(label: string): number {
  let h = 0
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) | 0
  return ((Math.abs(h) % 7) - 3) * 0.9
}

type Props = {
  label: string
  children?: ReactNode
  pressed?: boolean
  onToggle?: () => void
  size?: 'sm' | 'md'
}

export function Stamp({ label, children, pressed, onToggle, size = 'md' }: Props) {
  const style = { '--tilt': `${tilt(label)}deg` } as CSSProperties
  const className = `stamp stamp-${size}`
  if (onToggle) {
    return (
      <button type="button" className={className} aria-pressed={!!pressed} onClick={onToggle} style={style}>
        {children ?? label}
      </button>
    )
  }
  return (
    <span className={className} data-on="true" style={style}>
      {children ?? label}
    </span>
  )
}
