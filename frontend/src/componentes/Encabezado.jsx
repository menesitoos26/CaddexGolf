import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { obtenerIniciales } from '../utils/formato'
import Logo from './Logo'
import './encabezado.css'

const ENLACES = [
  { a: '/panel', texto: 'Dashboard' },
  { a: '/rondas', texto: 'Rondas' },
  { a: '/torneos', texto: 'Torneos' },
  { a: '/estadisticas', texto: 'Estadísticas' },
]

export default function Encabezado() {
  const { usuario, autenticado, cerrarSesion } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navegar = useNavigate()

  const cerrarMenu = () => setMenuAbierto(false)

  const salir = () => {
    cerrarMenu()
    cerrarSesion()
    navegar('/', { replace: true })
  }

  return (
    <header className="encabezado">
      <div className="encabezado-interior">
        <Link to={autenticado ? '/panel' : '/'} className="encabezado-marca" onClick={cerrarMenu}>
          <Logo tamano={22} />
          <span>Caddex</span>
        </Link>

        <button
          type="button"
          className="encabezado-hamburguesa"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          aria-expanded={menuAbierto}
          aria-controls="navegacion-principal"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          {menuAbierto ? '✕' : '☰'}
        </button>

        <nav
          id="navegacion-principal"
          className={`encabezado-nav ${menuAbierto ? 'abierto' : ''}`}
        >
          {autenticado && (
            <ul className="encabezado-enlaces">
              {ENLACES.map((enlace) => (
                <li key={enlace.a}>
                  <NavLink
                    to={enlace.a}
                    end={enlace.a === '/rondas'}
                    onClick={cerrarMenu}
                    className={({ isActive }) => (isActive ? 'activo' : '')}
                  >
                    {enlace.texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}

          <div className="encabezado-acciones">
            {autenticado ? (
              <>
                <Link to="/rondas/nueva" className="btn btn-primario btn-pequeno" onClick={cerrarMenu}>
                  Nueva ronda
                </Link>
                <Link to="/perfil" className="encabezado-perfil" onClick={cerrarMenu}>
                  <span className="encabezado-datos">
                    <span className="encabezado-nombre">{usuario?.name}</span>
                    <span className="encabezado-handicap">Hcp {usuario?.handicap ?? '—'}</span>
                  </span>
                  <span className="encabezado-avatar" aria-hidden="true">
                    {obtenerIniciales(usuario?.name)}
                  </span>
                </Link>
                <button type="button" className="encabezado-salir" onClick={salir}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secundario btn-pequeno" onClick={cerrarMenu}>
                  Entrar
                </Link>
                <Link to="/registro" className="btn btn-primario btn-pequeno" onClick={cerrarMenu}>
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
