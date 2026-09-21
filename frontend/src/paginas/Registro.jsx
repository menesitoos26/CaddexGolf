import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../componentes/Logo'
import { useAuth } from '../hooks/useAuth'
import { useNotificaciones } from '../hooks/useNotificaciones'
import './acceso.css'

const LONGITUD_MINIMA_PASSWORD = 8

export default function Registro() {
  const [datos, setDatos] = useState({ name: '', email: '', password: '', repetir: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const { registrarse } = useAuth()
  const { exito } = useNotificaciones()
  const navegar = useNavigate()

  const cambiar = (evento) => {
    const { name, value } = evento.target
    setDatos((anteriores) => ({ ...anteriores, [name]: value }))
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    setError('')

    // Validamos en cliente antes de gastar una petición.
    if (datos.password.length < LONGITUD_MINIMA_PASSWORD) {
      setError(`La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`)
      return
    }
    if (datos.password !== datos.repetir) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      const usuario = await registrarse({
        name: datos.name,
        email: datos.email,
        password: datos.password,
      })
      exito(`¡Cuenta creada! Bienvenido, ${usuario.name}.`)
      navegar('/panel', { replace: true })
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="acceso-pagina">
      <div className="acceso-tarjeta">
        <div className="acceso-marca">
          <Logo tamano={30} />
          <span>Caddex</span>
        </div>
        <h1>Crear cuenta</h1>
        <p className="acceso-subtitulo">Apunta. Analiza. Mejora.</p>

        <form className="formulario" onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="name">Nombre</label>
            <input
              type="text"
              id="name"
              name="name"
              autoComplete="name"
              required
              value={datos.name}
              onChange={cambiar}
            />
          </div>

          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
              value={datos.email}
              onChange={cambiar}
            />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={LONGITUD_MINIMA_PASSWORD}
              required
              value={datos.password}
              onChange={cambiar}
            />
            <span className="campo-ayuda">Mínimo {LONGITUD_MINIMA_PASSWORD} caracteres.</span>
          </div>

          <div className="campo">
            <label htmlFor="repetir">Repite la contraseña</label>
            <input
              type="password"
              id="repetir"
              name="repetir"
              autoComplete="new-password"
              required
              value={datos.repetir}
              onChange={cambiar}
            />
          </div>

          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="acceso-pie">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
