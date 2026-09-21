import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  IconoInicio,
  IconoMas,
  IconoPerfil,
  IconoRondas,
  IconoStats,
} from './Iconos'
import './barraInferior.css'

const IZQUIERDA = [
  { a: '/panel', texto: 'Inicio', Icono: IconoInicio },
  { a: '/rondas', texto: 'Rondas', Icono: IconoRondas },
]

const DERECHA = [
  { a: '/estadisticas', texto: 'Stats', Icono: IconoStats },
  { a: '/perfil', texto: 'Perfil', Icono: IconoPerfil },
]

/**
 * Barra de navegación tipo app, sólo en móvil.
 * El botón de nueva ronda flota por encima porque es la acción principal:
 * la app se usa de pie en el campo y ese botón tiene que caer bajo el pulgar.
 */
export default function BarraInferior() {
  const { autenticado } = useAuth()

  if (!autenticado) return null

  const enlace = ({ a, texto, Icono }) => (
    <NavLink
      key={a}
      to={a}
      end={a === '/rondas'}
      className={({ isActive }) => `barra-item ${isActive ? 'activo' : ''}`}
    >
      <Icono />
      <span>{texto}</span>
    </NavLink>
  )

  return (
    <nav className="barra-inferior" aria-label="Navegación principal">
      {IZQUIERDA.map(enlace)}

      <NavLink to="/rondas/nueva" className="barra-boton" aria-label="Nueva ronda">
        <IconoMas />
      </NavLink>

      {DERECHA.map(enlace)}
    </nav>
  )
}
