import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../componentes/Logo'
import { useAuth } from '../hooks/useAuth'
import { useNotificaciones } from '../hooks/useNotificaciones'
import './acceso.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const { iniciarSesion } = useAuth()
  const { exito } = useNotificaciones()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const enviar = async (evento) => {
    evento.preventDefault()
    setError('')
    setEnviando(true)

    try {
      const usuario = await iniciarSesion({ email, password })
      exito(`¡Bienvenido de nuevo, ${usuario.name}!`)
      navegar(ubicacion.state?.destino || '/panel', { replace: true })
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
        <h1>Bienvenido de nuevo</h1>
        <p className="acceso-subtitulo">Accede para registrar y analizar tus rondas.</p>

        <form className="formulario" onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

        </form>

        <p className="acceso-pie">
          ¿Todavía no tienes cuenta? <Link to="/registro">Regístrate gratis</Link>
        </p>
      </div>
    </div>
  )
}
