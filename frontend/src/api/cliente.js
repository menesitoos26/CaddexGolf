/**
 * Cliente único de la API.
 *
 * Centraliza la URL base, el token JWT y el tratamiento de errores para que
 * ninguna pantalla tenga que usar `fetch` directamente ni repetir la misma
 * lógica de manejo de respuestas.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const CLAVE_TOKEN = 'golftracker_token'
const CLAVE_PERFIL = 'caddex_perfil'

/** Error de API con el código HTTP, para poder distinguir 401 / 404 / 422. */
export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

export const almacenToken = {
  leer: () => localStorage.getItem(CLAVE_TOKEN),
  guardar: (token) => localStorage.setItem(CLAVE_TOKEN, token),
  borrar: () => localStorage.removeItem(CLAVE_TOKEN),
}

/**
 * Copia local del perfil.
 *
 * Sin esto, abrir la aplicación sin cobertura deja al jugador fuera: no se
 * puede preguntar al servidor quién es y no hay nada que mostrar. En un campo
 * de golf eso pasa constantemente, así que guardamos el último perfil conocido
 * y lo usamos mientras no haya red.
 */
export const almacenPerfil = {
  leer: () => {
    try {
      const guardado = localStorage.getItem(CLAVE_PERFIL)
      return guardado ? JSON.parse(guardado) : null
    } catch {
      return null
    }
  },
  guardar: (perfil) => {
    try {
      localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil))
    } catch {
      // Sin almacenamiento seguimos funcionando: sólo se pierde el modo offline.
    }
  },
  borrar: () => {
    try {
      localStorage.removeItem(CLAVE_PERFIL)
    } catch {
      // Nada que hacer.
    }
  },
}

/**
 * Distingue "no hay red" de "el servidor dice que no".
 *
 * Es la diferencia entre esperar a que vuelva la cobertura y cerrarle la
 * sesión al jugador en mitad del hoyo 7.
 */
export const esErrorDeRed = (error) => error instanceof ErrorApi && error.estado === 0

/**
 * Mensaje de error para las pantallas que sólo cargan datos.
 *
 * Estando sin cobertura, la banda de conexión ya lo está diciendo con calma y
 * explicando que no se pierde nada. Repetirlo justo debajo en rojo contradice
 * ese mensaje y parece que algo ha fallado de verdad, así que ahí se calla.
 *
 * En cambio, cuando el jugador ha pulsado un botón (entrar, guardar el perfil)
 * sí necesita ver por qué no ha pasado nada: esas pantallas usan el mensaje
 * completo.
 */
export const mensajeDeCarga = (fallo) => (esErrorDeRed(fallo) ? '' : fallo.message)

/** Convierte los errores de validación de FastAPI en un texto legible. */
function extraerMensaje(cuerpo, estado) {
  const detalle = cuerpo?.detail

  if (typeof detalle === 'string') return detalle

  if (Array.isArray(detalle)) {
    const mensajes = detalle
      .map((error) => error.msg?.replace(/^Value error,\s*/, ''))
      .filter(Boolean)
    if (mensajes.length > 0) return mensajes.join('. ')
  }

  if (estado === 401) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
  if (estado === 404) return 'No se ha encontrado lo que buscabas.'
  if (estado >= 500) return 'El servidor no está disponible. Inténtalo más tarde.'
  return 'Se ha producido un error inesperado.'
}

/** Se dispara cuando el token deja de ser válido, para que AuthContext cierre sesión. */
const SESION_CADUCADA = 'golftracker:sesion-caducada'
export const alCaducarSesion = (callback) => {
  window.addEventListener(SESION_CADUCADA, callback)
  return () => window.removeEventListener(SESION_CADUCADA, callback)
}

async function peticion(ruta, { metodo = 'GET', cuerpo, autenticada = true } = {}) {
  const cabeceras = {}
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'

  if (autenticada) {
    const token = almacenToken.leer()
    if (token) cabeceras.Authorization = `Bearer ${token}`
  }

  let respuesta
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    })
  } catch {
    throw new ErrorApi('No se ha podido conectar con el servidor.', 0)
  }

  if (respuesta.status === 204) return null

  const texto = await respuesta.text()
  const datos = texto ? JSON.parse(texto) : null

  if (!respuesta.ok) {
    if (respuesta.status === 401 && autenticada) {
      almacenToken.borrar()
      window.dispatchEvent(new Event(SESION_CADUCADA))
    }
    throw new ErrorApi(extraerMensaje(datos, respuesta.status), respuesta.status)
  }

  return datos
}

export const api = {
  // --- Autenticación ---
  registro: (datos) =>
    peticion('/auth/registro', { metodo: 'POST', cuerpo: datos, autenticada: false }),
  login: (datos) =>
    peticion('/auth/login', { metodo: 'POST', cuerpo: datos, autenticada: false }),
  perfil: () => peticion('/auth/me'),
  actualizarPerfil: (datos) => peticion('/auth/me', { metodo: 'PUT', cuerpo: datos }),

  // --- Campos ---
  buscarCampos: (texto) => peticion(`/campos?q=${encodeURIComponent(texto)}`),

  // --- Rondas ---
  crearRonda: (datos) => peticion('/rondas', { metodo: 'POST', cuerpo: datos }),
  listarRondas: ({ limit = 20, offset = 0, torneoId } = {}) => {
    const params = new URLSearchParams({ limit, offset })
    if (torneoId) params.set('tournament_id', torneoId)
    return peticion(`/rondas?${params}`)
  },
  ultimaRonda: () => peticion('/rondas/ultima'),
  detalleRonda: (id) => peticion(`/rondas/${id}`),
  actualizarRonda: (id, datos) => peticion(`/rondas/${id}`, { metodo: 'PATCH', cuerpo: datos }),
  borrarRonda: (id) => peticion(`/rondas/${id}`, { metodo: 'DELETE' }),

  // --- Torneos ---
  crearTorneo: (datos) => peticion('/torneos', { metodo: 'POST', cuerpo: datos }),
  listarTorneos: () => peticion('/torneos'),
  detalleTorneo: (id) => peticion(`/torneos/${id}`),
  actualizarTorneo: (id, datos) => peticion(`/torneos/${id}`, { metodo: 'PUT', cuerpo: datos }),
  borrarTorneo: (id) => peticion(`/torneos/${id}`, { metodo: 'DELETE' }),

  // --- Estadísticas ---
  estadisticas: () => peticion('/estadisticas'),
}
