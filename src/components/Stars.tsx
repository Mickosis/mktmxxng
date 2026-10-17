type ShowProps = { value: number | null; count?: number }

export function Stars({ value, count }: ShowProps) {
  if (value == null) return <span className="stars stars-empty">not rated</span>
  const rounded = Math.round(value)
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5${count ? `, ${count} visit${count === 1 ? '' : 's'}` : ''}`}>
      <span aria-hidden="true">
        {'★'.repeat(rounded)}
        <span className="stars-off">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="stars-num" aria-hidden="true">{value.toFixed(1)}</span>
      {count != null && <span className="stars-count" aria-hidden="true">×{count}</span>}
    </span>
  )
}

type InputProps = {
  value: number
  onChange: (v: number) => void
  label: string
  allowClear?: boolean
  size?: 'sm' | 'lg'
}

export function StarInput({ value, onChange, label, allowClear, size = 'lg' }: InputProps) {
  return (
    <div className={`star-input star-input-${size}`} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(allowClear && value === n ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}
