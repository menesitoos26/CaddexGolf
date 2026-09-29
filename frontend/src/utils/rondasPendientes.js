/**
 * Cola de rondas pendientes de enviar.
 *
 * El autoguardado (ver borradorRonda.js) evita perder la tarjeta mientras se
 * anota. Esto resuelve el escenario siguiente: el jugador termina los 18 hoyos,
 * pulsa guardar y no hay cobertura. La ronda está completa, es válida, y lo
 * único que falta es una red que puede no aparecer hasta el aparcamiento.
 *
 * En lugar de pedirle que lo recuerde, la ronda se guarda aquí y se reenvía
 * sola en cuanto vuelve la conexión.
 *
 * Por qué no Background Sync: la API de sincronización en segundo plano no
 * existe en iOS, y una parte de los jugadores usará iPhone. Una cola en
 * localStorage que se vacía al volver la conexión funciona en todas partes.
 */

const CLAVE = 'caddex_rondas_pendientes'
const VERSION = 1

// Una ronda pendiente más de una semana ya no tiene sentido reenviarla sin
// preguntar: la dejamos estar y que el jugador decida.
const CADUCIDAD_MS = 7 * 24 * 60 * 60 * 1000

function leerCrudo() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (!guardado) return []

    const datos = JSON.parse(guardado)
    if (datos?.version !== VERSION || !Array.isArray(datos.rondas)) return []

    const limite = Date.now() - CADUCIDAD_MS
    return datos.rondas.filter((r) => (r?.creadaEn ?? 0) > limite)
  } catch {
    return []
  }
}

function escribir(rondas) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION, rondas }))
    return true
  } catch {
    return false
  }
}

/** Mete una ronda en la cola. Devuelve false si el navegador no deja guardar. */
export function encolarRonda(payload) {
  const rondas = leerCrudo()
  rondas.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creadaEn: Date.now(),
    intentos: 0,
    payload,
  })
  return escribir(rondas)
}

export function leerPendientes() {
  return leerCrudo()
}

export function contarPendientes() {
  return leerCrudo().length
}

export function quitarPendiente(id) {
  escribir(leerCrudo().filter((r) => r.id !== id))
}

export function anotarIntentoFallido(id) {
  escribir(leerCrudo().map((r) => (r.id === id ? { ...r, intentos: r.intentos + 1 } : r)))
}

export function vaciarCola() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // La caducidad acabará limpiándola.
  }
}

/**
 * Intenta enviar todo lo pendiente.
 *
 * `enviar` es la función que hace la petición (se inyecta para no acoplar esto
 * al cliente de la API y poder probarlo). `esFalloDeRed` decide si conviene
 * reintentar más tarde o descartar.
 *
 * Distinción importante: si el servidor rechaza la ronda (un 422 por datos
 * inválidos, por ejemplo), reintentar eternamente no la va a arreglar y la cola
 * se quedaría atascada. Esas se descartan y se informa. Los fallos de red sí se
 * reintentan.
 */
export async function reenviarPendientes({ enviar, esFalloDeRed }) {
  const pendientes = leerPendientes()
  const resultado = { enviadas: 0, descartadas: 0, quedanPendientes: 0 }

  for (const ronda of pendientes) {
    try {
      await enviar(ronda.payload)
      quitarPendiente(ronda.id)
      resultado.enviadas += 1
    } catch (fallo) {
      if (esFalloDeRed(fallo)) {
        anotarIntentoFallido(ronda.id)
        // Sigue sin haber red: no tiene sentido intentar las demás ahora.
        break
      }
      // El servidor la ha rechazado: reintentarla no va a cambiar nada.
      quitarPendiente(ronda.id)
      resultado.descartadas += 1
    }
  }

  resultado.quedanPendientes = contarPendientes()
  return resultado
}
