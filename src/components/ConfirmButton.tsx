import { useEffect, useState, type ReactNode } from 'react'

type Props = { onConfirm: () => void | Promise<void>; children: ReactNode; confirmLabel: string; disabled?: boolean }

/** Destructive action that needs a second tap within a few seconds. */
export function ConfirmButton({ onConfirm, children, confirmLabel, disabled }: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      className={`btn btn-void${armed ? ' armed' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false)
          void onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
