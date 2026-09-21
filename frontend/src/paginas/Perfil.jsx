import { useEffect, useState } from 'react'
import { api } from '../api/cliente'
import { useAuth } from '../hooks/useAuth'
import { useNotificaciones } from '../hooks/useNotificaciones'
import { formatearNumero, obtenerIniciales } from '../utils/formato'
import './perfil.css'

export default function Perfil() {
  const { usuario, actualizarUsuario, cerrarSesion } = useAuth()
  const { exito } = useNotificaciones()

  // La ruta está protegida, así que al montar ya tenemos usuario.
  const [datos, setDatos] = useState({ name: usuario.name, email: usuario.email })
  const [passwords, setPasswords] = useState({ actual: '', nueva: '', repetir: '' })
  const [estadisticas, setEstadisticas] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let cancelado = false
    api
      .estadisticas()
      .then((datosStats) => !cancelado && setEstadisticas(datosStats))
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  const cambiaEmail = datos.email !== usuario.email
  const quiereCambiarPassword = passwords.nueva.length > 0

  const guardar = async (evento) => {
    evento.preventDefault()
    setError('')

    if (quiereCambiarPassword && passwords.nueva !== passwords.repetir) {
      setError('Las dos contraseñas nuevas no coinciden.')
      return
    }
    if ((cambiaEmail || quiereCambiarPassword) && !passwords.actual) {
      setError('Escribe tu contraseña actual para confirmar el cambio.')
      return
    }

    setGuardando(true)
    try {
      const actualizado = await api.actualizarPerfil({
        name: datos.name,
        email: datos.email,
        ...(quiereCambiarPassword ? { password: passwords.nueva } : {}),
        ...(cambiaEmail || quiereCambiarPassword
          ? { current_password: passwords.actual }
          : {}),
      })

      actualizarUsuario(actualizado)
      setPasswords({ actual: '', nueva: '', repetir: '' })
      exito('Perfil actualizado.')
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  const resumen = estadisticas?.resumen

  return (
    <div className="pagina">
      <div className="contenedor">
        <div className="pagina-cabecera">
          <div>
            <h1>Mi perfil</h1>
            <p>Tus datos de acceso y un resumen de tu actividad.</p>
          </div>
        </div>

        <section className="perfil-resumen seccion">
          <span className="perfil-avatar" aria-hidden="true">
            {obtenerIniciales(usuario?.name)}
          </span>
          <div>
            <h2>{usuario?.name}</h2>
            <p className="texto-tenue">{usuario?.email}</p>
          </div>
        </section>

        <section className="rejilla-metricas seccion">
          <article className="metrica">
            <span className="metrica-etiqueta">Hándicap</span>
            <span className="metrica-valor">{usuario?.handicap ?? '—'}</span>
          </article>
          <article className="metrica">
            <span className="metrica-etiqueta">Rondas</span>
            <span className="metrica-valor">{resumen?.total_rondas ?? 0}</span>
          </article>
          <article className="metrica">
            <span className="metrica-etiqueta">Torneos</span>
            <span className="metrica-valor">{resumen?.total_torneos ?? 0}</span>
          </article>
          <article className="metrica">
            <span className="metrica-etiqueta">Media 18 hoyos</span>
            <span className="metrica-valor">{formatearNumero(resumen?.media_golpes_18)}</span>
          </article>
        </section>

        <section className="tarjeta seccion perfil-formulario">
          <h2 className="seccion-titulo">Datos de la cuenta</h2>

          <form className="formulario" onSubmit={guardar}>
            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="name">Nombre</label>
                <input
                  id="name"
                  type="text"
                  required
                  minLength={2}
                  value={datos.name}
                  onChange={(e) => setDatos({ ...datos, name: e.target.value })}
                />
              </div>

              <div className="campo">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={datos.email}
                  onChange={(e) => setDatos({ ...datos, email: e.target.value })}
                />
              </div>
            </div>

            <h3 className="seccion-titulo perfil-subtitulo">Cambiar contraseña</h3>

            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="nueva">Nueva contraseña</label>
                <input
                  id="nueva"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Déjalo vacío para no cambiarla"
                  value={passwords.nueva}
                  onChange={(e) => setPasswords({ ...passwords, nueva: e.target.value })}
                />
              </div>

              <div className="campo">
                <label htmlFor="repetir">Repite la nueva contraseña</label>
                <input
                  id="repetir"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.repetir}
                  onChange={(e) => setPasswords({ ...passwords, repetir: e.target.value })}
                />
              </div>
            </div>

            {(cambiaEmail || quiereCambiarPassword) && (
              <div className="campo">
                <label htmlFor="actual">Contraseña actual</label>
                <input
                  id="actual"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwords.actual}
                  onChange={(e) => setPasswords({ ...passwords, actual: e.target.value })}
                />
                <span className="campo-ayuda">
                  Por seguridad, confirma tu contraseña para cambiar el correo o la contraseña.
                </span>
              </div>
            )}

            {error && (
              <p className="mensaje-error" role="alert">
                {error}
              </p>
            )}

            <div className="acciones-formulario">
              <button type="button" className="btn btn-secundario" onClick={cerrarSesion}>
                Cerrar sesión
              </button>
              <button type="submit" className="btn btn-primario" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
