/**
 * Autoguardado de la ronda en curso.
 *
 * Una tarjeta se anota a lo largo de cuatro o cinco horas, en el campo, con el
 * móvil bloqueándose entre hoyo y hoyo. Si el navegador descarta la pestaña
 * (iOS lo hace con mucha soltura cuando hay presión de memoria), si el jugador
 * se va a WhatsApp y vuelve, o si el móvil se queda sin batería, el estado de
 * React desaparece y con él la tarjeta entera. Por eso se replica aquí después
 * de cada cambio.
 *
 * Todo va envuelto en try/catch a propósito: en modo privado, con la cuota
 * llena o con el almacenamiento bloqueado por el navegador, `localStorage`
 * lanza excepción. Perder el autoguardado es un fastidio; impedir que el
 * jugador siga anotando sería mucho peor.
 */

const CLAVE = 'caddex_ronda_borrador'

// Si algún día cambia la forma de la tarjeta, subir la versión hace que los
// borradores viejos se descarten en vez de rehidratar un estado imposible.
const VERSION = 1

// Una ronda dura media mañana. Más allá de dos días es un borrador olvidado,
// y recuperarlo sin avisar confunde más que ayuda.
const CADUCIDAD_MS = 48 * 60 * 60 * 1000

/** Guarda el borrador. Devuelve false si el navegador no deja escribir. */
export function guardarBorrador(borrador) {
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ ...borrador, version: VERSION, guardadoEn: Date.now() }),
    )
    return true
  } catch {
    return false
  }
}

/** Devuelve el borrador guardado, o null si no hay, está caducado o corrupto. */
export function leerBorrador() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null

    const datos = JSON.parse(crudo)

    const valido =
      datos?.version === VERSION &&
      Array.isArray(datos.hoyos) &&
      datos.hoyos.length > 0 &&
      Date.now() - (datos.guardadoEn ?? 0) < CADUCIDAD_MS

    if (!valido) {
      borrarBorrador()
      return null
    }

    return datos
  } catch {
    // JSON corrupto o acceso denegado: mejor empezar limpio que romper la pantalla.
    borrarBorrador()
    return null
  }
}

export function borrarBorrador() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Si no se puede borrar, la caducidad acabará descartándolo igualmente.
  }
}

/**
 * Evita guardar (y luego "recuperar") una tarjeta en blanco: sólo merece la
 * pena si el jugador ya ha anotado algún hoyo o ha escrito el campo.
 */
export function mereceLaPenaGuardar({ hoyos, campo }) {
  const hayAlgunHoyoAnotado = hoyos.some(
    (hoyo) => hoyo.strokes !== '' && hoyo.strokes !== null && hoyo.strokes !== undefined,
  )
  return hayAlgunHoyoAnotado || Boolean(campo?.name?.trim())
}

/** Cuántos hoyos lleva anotados el borrador, para poder decírselo al jugador. */
export function hoyosAnotados(hoyos) {
  return hoyos.filter((hoyo) => hoyo.strokes !== '' && Number(hoyo.strokes) > 0).length
}
