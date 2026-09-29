import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/cliente'
import Logo from '../componentes/Logo'
import { useNotificaciones } from '../hooks/useNotificaciones'
import './acceso.css'

const LONGITUD_MINIMA = 8

export default function Restablecer() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token') || ''
  const navegar = useNavigate()
  const { exito } = useNotificaciones()

  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (evento) => {
    evento.preventDefault()
    setError('')

    // Se comprueba aquí para dar respuesta inmediata, pero el servidor vuelve
    // a validarlo: esto es comodidad, no seguridad.
    if (password.length < LONGITUD_MINIMA) {
      setError(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`)
      return
    }
    if (password !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      await api.restablecerContrasena(token, password)
      exito('Contraseña actualizada. Ya puedes entrar con la nueva.')
      navegar('/login', { replace: true })
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setEnviando(false)
    }
  }

  // Entrar aquí sin token sólo pasa si alguien recorta el enlace del correo.
  if (!token) {
    return (
      <div className="acceso-pagina">
        <div className="acceso-tarjeta">
          <div className="acceso-marca">
            <Logo tamano={30} />
            <span>Caddex</span>
          </div>
          <h1>Enlace incompleto</h1>
          <p className="acceso-subtitulo">
            A este enlace le falta el código de verificación. Copia la dirección
            completa del correo, o pide uno nuevo.
          </p>
          <p className="acceso-pie">
            <Link to="/recuperar">Pedir un enlace nuevo</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="acceso-pagina">
      <div className="acceso-tarjeta">
        <div className="acceso-marca">
          <Logo tamano={30} />
          <span>Caddex</span>
        </div>
        <h1>Elige una contraseña nueva</h1>
        <p className="acceso-subtitulo">
          Al guardarla se cerrarán las sesiones abiertas en otros dispositivos.
        </p>

        <form className="formulario" onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="password">Contraseña nueva</label>
            <input
              type="password"
              id="password"
              autoComplete="new-password"
              required
              minLength={LONGITUD_MINIMA}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="repetida">Repítela</label>
            <input
              type="password"
              id="repetida"
              autoComplete="new-password"
              required
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </div>

          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>

        <p className="acceso-pie">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
