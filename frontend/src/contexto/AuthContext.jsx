import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  alCaducarSesion,
  almacenPerfil,
  almacenToken,
  api,
  esErrorDeRed,
} from '../api/cliente'
import { AuthContext } from './contextos'

export function AuthProvider({ children }) {
  // Arrancamos con el último perfil conocido: así la aplicación es utilizable
  // desde el primer instante aunque no haya cobertura para validar el token.
  const [usuario, setUsuario] = useState(() =>
    almacenToken.leer() ? almacenPerfil.leer() : null,
  )
  // `cargando` evita el parpadeo de "no autenticado" mientras validamos el token.
  const [cargando, setCargando] = useState(true)
  const [sinConexion, setSinConexion] = useState(() => !navigator.onLine)

  const cerrarSesion = useCallback(() => {
    almacenToken.borrar()
    almacenPerfil.borrar()
    setUsuario(null)
  }, [])

  const recordarUsuario = useCallback((perfil) => {
    almacenPerfil.guardar(perfil)
    setUsuario(perfil)
  }, [])

  // Al arrancar validamos el token contra el servidor: así detectamos tokens
  // caducados o de un usuario ya borrado, cosa que mirar el localStorage no hace.
  //
  // Pero un fallo de red NO es un token inválido. Antes cualquier error cerraba
  // la sesión, así que abrir la aplicación en un campo sin cobertura expulsaba
  // al jugador y le hacía perder la ronda que estuviera anotando. Ahora sólo
  // cerramos sesión cuando el servidor dice explícitamente que el token no vale.
  useEffect(() => {
    let cancelado = false

    async function recuperarSesion() {
      if (!almacenToken.leer()) {
        setCargando(false)
        return
      }
      try {
        const perfil = await api.perfil()
        if (!cancelado) {
          recordarUsuario(perfil)
          setSinConexion(false)
        }
      } catch (fallo) {
        if (cancelado) return

        if (esErrorDeRed(fallo)) {
          setSinConexion(true)
          // Seguimos con el perfil cacheado. Si no hay ninguno no podemos
          // mostrar nada útil, así que ahí sí devolvemos al login.
          if (!almacenPerfil.leer()) cerrarSesion()
        } else {
          cerrarSesion()
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    recuperarSesion()
    return () => {
      cancelado = true
    }
  }, [cerrarSesion, recordarUsuario])

  // Si cualquier petición recibe un 401, cerramos sesión en toda la aplicación.
  useEffect(() => alCaducarSesion(cerrarSesion), [cerrarSesion])

  // El navegador avisa de los cambios de conectividad. No es infalible (avisa
  // de que hay red, no de que el servidor responda), pero sirve para mover el
  // aviso de la interfaz y para disparar el reenvío de rondas pendientes.
  useEffect(() => {
    const conectado = () => setSinConexion(false)
    const desconectado = () => setSinConexion(true)

    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)
    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [])

  const iniciarSesion = useCallback(
    async (credenciales) => {
      const datos = await api.login(credenciales)
      almacenToken.guardar(datos.access_token)
      recordarUsuario(datos.user)
      return datos.user
    },
    [recordarUsuario],
  )

  const registrarse = useCallback(
    async (datos) => {
      const respuesta = await api.registro(datos)
      almacenToken.guardar(respuesta.access_token)
      recordarUsuario(respuesta.user)
      return respuesta.user
    },
    [recordarUsuario],
  )

  const actualizarUsuario = useCallback((datosNuevos) => {
    setUsuario((anterior) => {
      if (!anterior) return anterior
      const actualizado = { ...anterior, ...datosNuevos }
      almacenPerfil.guardar(actualizado)
      return actualizado
    })
  }, [])

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      sinConexion,
      autenticado: usuario !== null,
      iniciarSesion,
      registrarse,
      cerrarSesion,
      actualizarUsuario,
    }),
    [
      usuario,
      cargando,
      sinConexion,
      iniciarSesion,
      registrarse,
      cerrarSesion,
      actualizarUsuario,
    ],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
