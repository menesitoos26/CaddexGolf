/**
 * Iconografía del sistema: retícula de 20×20, trazo de 1.6 y remates rectos.
 * `color` se hereda de `currentColor` para que cada sitio decida el estado.
 */

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  'aria-hidden': true,
  focusable: 'false',
}

export function IconoInicio() {
  return (
    <svg {...base}>
      <rect x="2" y="2" width="7" height="7" />
      <rect x="11" y="2" width="7" height="7" />
      <rect x="2" y="11" width="7" height="7" />
      <rect x="11" y="11" width="7" height="7" />
    </svg>
  )
}

export function IconoRondas() {
  return (
    <svg {...base}>
      <path d="M3 17V3" />
      <path d="M4 4h11l-4 3.5 4 3.5H4z" />
    </svg>
  )
}

export function IconoStats() {
  return (
    <svg {...base}>
      <path d="M3 17h14" />
      <path d="M5 14V9M10 14V4M15 14v-7" />
    </svg>
  )
}

export function IconoPerfil() {
  return (
    <svg {...base}>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M4 17c1.6-3 4-4 6-4s4.4 1 6 4" />
    </svg>
  )
}

export function IconoMas() {
  return (
    <svg {...base} viewBox="0 0 22 22" width="24" height="24" strokeWidth="2.6">
      <path d="M11 3v16M3 11h16" />
    </svg>
  )
}

export function IconoTorneos() {
  return (
    <svg {...base}>
      <path d="M6 3h8v4a4 4 0 0 1-8 0V3z" />
      <path d="M10 11v4M7 17h6" />
    </svg>
  )
}
