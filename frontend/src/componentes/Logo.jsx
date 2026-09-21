/**
 * Símbolo de Caddex: bandera con línea de progreso ascendente.
 * Trazo de 2.2 y remates cuadrados, la misma retícula que el resto de iconos.
 */
export default function Logo({ tamano = 32, variante = 'color' }) {
  const asta = variante === 'solido' ? '#14161C' : '#F4F6F1'
  const bandera = variante === 'solido' ? '#14161C' : '#C4F23C'

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 30V3" stroke={asta} strokeWidth="2.2" strokeLinecap="square" />
      <path d="M9.5 4h13l-4.5 4.5 4.5 4.5h-13z" fill={bandera} />
      <path
        d="M8 25l6-5 5 3 7-9"
        stroke={bandera}
        strokeWidth="2.2"
        strokeLinecap="square"
        opacity={variante === 'solido' ? 0.45 : 1}
      />
    </svg>
  )
}
