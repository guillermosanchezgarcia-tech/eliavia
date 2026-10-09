import { cx } from '../lib/cx'
import { silueta } from '../lib/geometria'
import type { RecintoSigpac } from '../lib/sigpac'

export function Silueta({ geometria, className }: { geometria: RecintoSigpac['geometria']; className?: string }) {
  const d = silueta(geometria)
  return (
    <svg viewBox="0 0 100 100" className={cx('shrink-0 rounded-lg bg-marca-50', className)} aria-hidden>
      {d ? (
        <path d={d} fill="#bbf7d0" stroke="#15803d" strokeWidth="2.5" strokeLinejoin="round" fillRule="evenodd" />
      ) : (
        <rect x="30" y="30" width="40" height="40" rx="4" fill="none" stroke="#a8a29e" strokeDasharray="4 4" strokeWidth="2" />
      )}
    </svg>
  )
}
