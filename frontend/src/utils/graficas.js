/** Estilos de gráfica del sistema Caddex.
 *
 * Regla del sistema: línea de 2.5–3, relleno al 10 %, rejilla en --linea
 * y sin ejes decorativos. El dato manda, el adorno no.
 */

export const COLORES = {
  voltio: '#c4f23c',
  voltioSuave: 'rgba(196, 242, 60, 0.10)',
  negativo: '#e06b6b',
  rejilla: '#2c313d',
  ejes: '#5c636e',
  acero: '#8a9199',
  superficie: '#232733',
}

export const ESTILO_TOOLTIP = {
  backgroundColor: '#1b1e26',
  border: '1px solid #2c313d',
  borderRadius: 10,
  color: '#f4f6f1',
  fontFamily: 'Sora, sans-serif',
  fontSize: 13,
}

export const ESTILO_EJE = {
  stroke: COLORES.ejes,
  fontSize: 11,
  fontFamily: 'Inter, sans-serif',
  tickLine: false,
  axisLine: false,
}

/** Reparto de resultados: del voltio (mejor) al rojo (peor). */
export const COLORES_REPARTO = [
  '#c4f23c',
  '#a8dc4e',
  '#8ac45c',
  '#8a9199',
  '#c98a76',
  '#e06b6b',
]
