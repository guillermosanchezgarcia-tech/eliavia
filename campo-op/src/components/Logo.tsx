/** Logotipo de la app (el mismo dibujo que el icono del móvil). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#15803d" />
      <path
        d="M256 92a124 124 0 0 1 124 124c0 92-124 220-124 220S132 308 132 216A124 124 0 0 1 256 92z"
        fill="#fff"
      />
      <path d="M184 266v-50l24-26 24 26 24-26 24 26 24-26 24 26v50z" fill="#15803d" />
      <path d="M232 216v50M280 216v50" stroke="#fff" strokeWidth="7" />
    </svg>
  )
}
