import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import Logo from '../componentes/Logo'
import './acceso.css'

export default function Recuperar() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (evento) => {
    evento.preventDefault()
    setError('')
    setEnviando(true)

    try {
      const respuesta = await api.recuperarContrasena(email.trim())
      setMensaje(respuesta.mensaje)
      setEnviado(true)
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

        {enviado ? (
          <>
            <h1>Revisa tu correo</h1>
            {/* El mensaje viene del servidor y es deliberadamente ambiguo: no
                confirma si esa cuenta existe, para que esta pantalla no sirva
                para averiguar qué correos están registrados. */}
            <p className="acceso-subtitulo">{mensaje}</p>
            <p className="acceso-pie">
              <Link to="/login">Volver a iniciar sesión</Link>
            </p>
          </>
        ) : (
          <>
            <h1>¿Has olvidado tu contraseña?</h1>
            <p className="acceso-subtitulo">
              Escribe tu correo y te enviamos un enlace para elegir una nueva.
            </p>

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

              {error && (
                <p className="mensaje-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-primario" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviarme el enlace'}
              </button>
            </form>

            <p className="acceso-pie">
              ¿Te has acordado? <Link to="/login">Inicia sesión</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
