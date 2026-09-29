import { useCallback, useEffect, useRef, useState } from 'react'
import { api, esErrorDeRed } from '../api/cliente'
import { useAuth } from '../hooks/useAuth'
import { useNotificaciones } from '../hooks/useNotificaciones'
import { contarPendientes, reenviarPendientes } from '../utils/rondasPendientes'
import './estadoConexion.css'

/**
 * Banda de estado de conexión y reenvío de rondas pendientes.
 *
 * Hace dos cosas que el jugador necesita sin tener que preguntarse nada: avisa
 * de que está sin cobertura —para que no interprete un fallo de guardado como
 * una pérdida de datos— y reenvía solo lo que quedó pendiente en cuanto vuelve
 * la red.
 */
export default function EstadoConexion() {
  const { autenticado, sinConexion } = useAuth()
  const { exito, error: avisarError } = useNotificaciones()
  const [pendientes, setPendientes] = useState(() => contarPendientes())
  const [enviando, setEnviando] = useState(false)

  // La guarda vive en un ref y no en el estado a propósito: si dependiera de
  // `enviando`, cambiaría la identidad de `vaciar` en cada envío, el efecto de
  // abajo se volvería a montar y acabaríamos reenviando en bucle.
  const enviandoRef = useRef(false)

  const vaciar = useCallback(async () => {
    if (!autenticado || enviandoRef.current || contarPendientes() === 0) return

    enviandoRef.current = true
    setEnviando(true)
    try {
      const resultado = await reenviarPendientes({
        enviar: (payload) => api.crearRonda(payload),
        esFalloDeRed: esErrorDeRed,
      })

      if (resultado.enviadas > 0) {
        exito(
          resultado.enviadas === 1
            ? 'Tu ronda pendiente ya está guardada en tu cuenta.'
            : `${resultado.enviadas} rondas pendientes ya están guardadas en tu cuenta.`,
        )
      }
      if (resultado.descartadas > 0) {
        avisarError(
          resultado.descartadas === 1
            ? 'Una ronda pendiente fue rechazada por el servidor y se ha descartado.'
            : `${resultado.descartadas} rondas pendientes fueron rechazadas y se han descartado.`,
        )
      }
      setPendientes(resultado.quedanPendientes)
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }, [autenticado, exito, avisarError])

  useEffect(() => {
    const intentar = () => {
      vaciar()
    }

    // El navegador avisa cuando recupera la red.
    window.addEventListener('online', intentar)

    // Y un primer intento al abrir la aplicación, aplazado un tick para no
    // disparar un render en cascada desde el propio efecto.
    const temporizador = setTimeout(intentar, 0)

    return () => {
      window.removeEventListener('online', intentar)
      clearTimeout(temporizador)
    }
  }, [vaciar])

  // La pantalla de nueva ronda (u otra pestaña) puede haber encolado algo.
  useEffect(() => {
    const revisar = () => setPendientes(contarPendientes())
    window.addEventListener('focus', revisar)
    window.addEventListener('storage', revisar)
    return () => {
      window.removeEventListener('focus', revisar)
      window.removeEventListener('storage', revisar)
    }
  }, [])

  if (!autenticado) return null
  if (!sinConexion && pendientes === 0) return null

  return (
    <div
      className={`banda-conexion ${
        sinConexion ? 'banda-conexion--sin-red' : 'banda-conexion--pendiente'
      }`}
      role="status"
    >
      {sinConexion ? (
        <span>
          Sin conexión. Puedes seguir anotando: se guarda en el móvil y se enviará
          al recuperar cobertura.
        </span>
      ) : (
        <span>
          {enviando
            ? 'Enviando rondas pendientes…'
            : `${pendientes} ${
                pendientes === 1 ? 'ronda pendiente' : 'rondas pendientes'
              } de enviar.`}
        </span>
      )}

      {!sinConexion && pendientes > 0 && !enviando && (
        <button type="button" className="btn-texto" onClick={vaciar}>
          Reintentar ahora
        </button>
      )}
    </div>
  )
}
