import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './landing.css'

const CARACTERISTICAS = [
  {
    icono: '⛳',
    titulo: 'Registro hoyo a hoyo',
    texto: 'Anota golpes, putts, calles y greenes de cada hoyo al terminar la partida.',
  },
  {
    icono: '📈',
    titulo: 'Hándicap automático',
    texto: 'Se recalcula solo con cada ronda siguiendo el método del World Handicap System.',
  },
  {
    icono: '📊',
    titulo: 'Estadísticas de verdad',
    texto: 'Media por tipo de hoyo, reparto de birdies y bogeys, evolución y mejores campos.',
  },
  {
    icono: '🏆',
    titulo: 'Historial de torneos',
    texto: 'Agrupa las rondas por competición y consulta tus resultados de un vistazo.',
  },
]

const PASOS = [
  { numero: 1, titulo: 'Crea tu cuenta', texto: 'Te lleva menos de un minuto y es gratis.' },
  {
    numero: 2,
    titulo: 'Juega y registra',
    texto: 'Al acabar la vuelta, introduce tu tarjeta hoyo a hoyo.',
  },
  {
    numero: 3,
    titulo: 'Analiza y mejora',
    texto: 'Revisa tus estadísticas y descubre dónde estás perdiendo golpes.',
  },
]

export default function Landing() {
  const { autenticado } = useAuth()

  return (
    <div className="publica-pagina">
      <section className="publica-hero">
        <div className="publica-hero-contenido">
          <span className="publica-kicker">Tu progreso, hoyo a hoyo</span>
          <h1>Mejora tu juego ronda a ronda</h1>
          <p>
            Caddex digitaliza tu tarjeta: registra tus partidas y tus torneos, calcula tu hándicap
            con el método del World Handicap System y te enseña exactamente dónde estás perdiendo
            golpes.
          </p>
          <div className="publica-hero-botones">
            {autenticado ? (
              <Link to="/panel" className="btn btn-primario">
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link to="/registro" className="btn btn-primario">
                  Crear cuenta gratis
                </Link>
                <Link to="/login" className="btn btn-secundario">
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="publica-seccion">
        <div className="publica-seccion-cabecera">
          <span className="publica-seccion-numero">01</span>
          <h2 className="publica-titulo-seccion">Todo para bajar tu hándicap</h2>
          <p className="publica-subtitulo-seccion">
            Anotar, analizar y entender tu evolución en un solo sitio
          </p>
        </div>

        <div className="publica-grid-caracteristicas">
          {CARACTERISTICAS.map((caracteristica) => (
            <article className="publica-tarjeta" key={caracteristica.titulo}>
              <span className="publica-icono" aria-hidden="true">
                {caracteristica.icono}
              </span>
              <h3>{caracteristica.titulo}</h3>
              <p>{caracteristica.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publica-seccion">
        <div className="publica-seccion-cabecera">
          <span className="publica-seccion-numero">02</span>
          <h2 className="publica-titulo-seccion">Cómo funciona</h2>
          <p className="publica-subtitulo-seccion">Tres pasos, ninguna hoja de cálculo</p>
        </div>

        <div className="publica-pasos">
          {PASOS.map((paso) => (
            <div className="publica-paso" key={paso.numero}>
              <div className="publica-paso-numero">{paso.numero}</div>
              <h3>{paso.titulo}</h3>
              <p>{paso.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {!autenticado && (
        <section className="publica-cta">
          <h2>¿Listo para empezar a mejorar?</h2>
          <p>Únete gratis y registra tu primera ronda hoy mismo.</p>
          <Link to="/registro" className="btn btn-primario">
            Crear cuenta gratis
          </Link>
        </section>
      )}

      <footer className="publica-footer">
        <p>Caddex Golf · Proyecto Fin de Grado (DAW)</p>
      </footer>
    </div>
  )
}
