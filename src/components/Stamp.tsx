import type { ReactNode } from 'react'

type Props = {
  label: string
  children?: ReactNode
  pressed?: boolean
  onToggle?: () => void
  size?: 'sm' | 'md'
}

/** A tag: printed label when read-only, toggle button when onToggle is given. */
export function Stamp({ label, children, pressed, onToggle, size = 'md' }: Props) {
  const className = `stamp stamp-${size}`
  if (onToggle) {
    return (
      <button type="button" className={className} aria-pressed={!!pressed} onClick={onToggle}>
        {children ?? label}
      </button>
    )
  }
  return <span className={className}>{children ?? label}</span>
}
