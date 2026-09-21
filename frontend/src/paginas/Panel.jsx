import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/cliente'
import Cargando from '../componentes/Cargando'
import EstadoVacio from '../componentes/EstadoVacio'
import { useAuth } from '../hooks/useAuth'
import {
  claseDiferencia,
  formatearDiferencia,
  formatearFecha,
  formatearNumero,
} from '../utils/formato'
import { COLORES, ESTILO_EJE, ESTILO_TOOLTIP } from '../utils/graficas'
import './panel.css'

const RANGOS = [
  { clave: 5, texto: '5' },
  { clave: 10, texto: '10' },
  { clave: 20, texto: '20' },
  { clave: 0, texto: 'Todo' },
]

export default function Panel() {
  const { usuario } = useAuth()
  const navegar = useNavigate()

  const [estadisticas, setEstadisticas] = useState(null)
  const [rondas, setRondas] = useState([])
  const [rango, setRango] = useState(10)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false

    Promise.all([api.estadisticas(), api.listarRondas({ limit: 5 })])
      .then(([stats, pagina]) => {
        if (cancelado) return
        setEstadisticas(stats)
        setRondas(pagina.items)
      })
      .catch((fallo) => !cancelado && setError(fallo.message))
      .finally(() => !cancelado && setCargando(false))

    return () => {
      cancelado = true
    }
  }, [])

  if (cargando) return <Cargando texto="Cargando tu dashboard…" />

  const resumen = estadisticas?.resumen
  const evolucion = estadisticas?.evolucion ?? []
  const visibles = rango === 0 ? evolucion : evolucion.slice(-rango)

  const datosTendencia = visibles.map((punto) => ({
    fecha: formatearFecha(punto.played_on),
    campo: punto.campo,
    'Sobre par': punto.diferencia_par_18,
  }))

  // La mejora se mide comparando la primera y la última ronda del rango.
  const variacion =
    visibles.length >= 2
      ? Number(
          (
            visibles[visibles.length - 1].diferencia_par_18 - visibles[0].diferencia_par_18
          ).toFixed(1),
        )
      : null

  return (
    <div className="pagina">
      <div className="contenedor">
        <div className="pagina-cabecera">
          <div>
            <span className="etiqueta-campo">Apunta. Analiza. Mejora.</span>
            <h1>Hola, {usuario?.name?.split(' ')[0]}</h1>
          </div>
          <Link to="/rondas/nueva" className="btn btn-primario">
            Nueva ronda
          </Link>
        </div>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <div className="panel-rejilla">
          <div className="panel-columna">
            <section className="tarjeta panel-hero">
              <div className="panel-hero-cabecera">
                <div className="panel-hero-cifras">
                  <div>
                    <span className="etiqueta-campo">Hándicap actual</span>
                    <span className="cifra metrica-valor metrica-valor-grande">
                      {usuario?.handicap ?? '—'}
                    </span>
                  </div>
                  {variacion !== null && (
                    <div className="panel-hero-delta">
                      <span
                        className={`cifra ${variacion < 0 ? 'resultado-bajo-par' : 'resultado-sobre-par'}`}
                      >
                        {variacion > 0 ? `+${variacion}` : variacion}
                      </span>
                      <span className="metrica-nota">
                        en las últimas {visibles.length} rondas
                      </span>
                    </div>
                  )}
                </div>

                {evolucion.length > 1 && (
                  <div className="segmentado panel-rangos">
                    {RANGOS.map((opcion) => (
                      <button
                        key={opcion.clave}
                        type="button"
                        aria-pressed={rango === opcion.clave}
                        onClick={() => setRango(opcion.clave)}
                      >
                        {opcion.texto}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {datosTendencia.length === 0 ? (
                <EstadoVacio
                  icono="⛳"
                  titulo="Aún no hay datos"
                  descripcion="Registra tu primera vuelta y aquí verás tu evolución ronda a ronda."
                  accion={{ a: '/rondas/nueva', texto: 'Registrar mi primera ronda' }}
                />
              ) : (
                <div className="panel-tendencia">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={datosTendencia}
                      margin={{ top: 8, right: 4, left: -28, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="degradadoVoltio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORES.voltio} stopOpacity={0.22} />
                          <stop offset="100%" stopColor={COLORES.voltio} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke={COLORES.rejilla}
                        strokeDasharray="0"
                      />
                      <XAxis dataKey="fecha" {...ESTILO_EJE} />
                      <YAxis {...ESTILO_EJE} width={54} />
                      <Tooltip
                        contentStyle={ESTILO_TOOLTIP}
                        labelFormatter={(valor, carga) =>
                          carga?.[0] ? `${carga[0].payload.campo} · ${valor}` : valor
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="Sobre par"
                        stroke={COLORES.voltio}
                        strokeWidth={3}
                        fill="url(#degradadoVoltio)"
                        dot={{ r: 3, fill: COLORES.voltio, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="tarjeta-tabla">
              <div className="tarjeta-tabla-cabecera">
                <span className="etiqueta-campo">Últimas rondas</span>
                <Link to="/rondas" className="btn-texto">
                  Ver todas
                </Link>
              </div>

              {rondas.length === 0 ? (
                <EstadoVacio
                  icono="📋"
                  titulo="Todavía no hay rondas"
                  descripcion="Cuando registres una vuelta aparecerá aquí con su resultado."
                />
              ) : (
                <div className="tabla-envoltorio tabla-sin-marco">
                  <table className="tabla tabla-clicable">
                    <thead>
                      <tr>
                        <th scope="col" className="alinear-izquierda">
                          Campo
                        </th>
                        <th scope="col">Fecha</th>
                        <th scope="col">Golpes</th>
                        <th scope="col">Par</th>
                        <th scope="col">Hoyos</th>
                        <th scope="col">Putts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rondas.map((ronda) => (
                        <tr
                          key={ronda.id}
                          tabIndex={0}
                          onClick={() => navegar(`/rondas/${ronda.id}`)}
                          onKeyDown={(e) => e.key === 'Enter' && navegar(`/rondas/${ronda.id}`)}
                        >
                          <td className="alinear-izquierda">{ronda.course.name}</td>
                          <td className="texto-tenue">{formatearFecha(ronda.played_on)}</td>
                          <td className="texto-fuerte">{ronda.total_strokes}</td>
                          <td className={claseDiferencia(ronda.diferencia_par)}>
                            {formatearDiferencia(ronda.diferencia_par)}
                          </td>
                          <td className="texto-tenue">{ronda.holes_played}</td>
                          <td className="texto-tenue">{ronda.total_putts ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="panel-columna panel-lateral">
            <div className="panel-metricas">
              <article className="metrica">
                <span className="metrica-etiqueta">Greenes</span>
                <span className="cifra metrica-valor">
                  {resumen?.porcentaje_greenes === null ? '—' : `${resumen?.porcentaje_greenes}%`}
                </span>
                <span className="metrica-nota">En regulación</span>
              </article>
              <article className="metrica">
                <span className="metrica-etiqueta">Calles</span>
                <span className="cifra metrica-valor">
                  {resumen?.porcentaje_calles === null ? '—' : `${resumen?.porcentaje_calles}%`}
                </span>
                <span className="metrica-nota">Par 4 y 5</span>
              </article>
              <article className="metrica">
                <span className="metrica-etiqueta">Putts / hoyo</span>
                <span className="cifra metrica-valor">
                  {resumen?.media_putts_18
                    ? formatearNumero(resumen.media_putts_18 / 18, 2)
                    : '—'}
                </span>
                <span className="metrica-nota">Media</span>
              </article>
              <article className="metrica">
                <span className="metrica-etiqueta">Media 18h</span>
                <span className="cifra metrica-valor">
                  {formatearNumero(resumen?.media_golpes_18)}
                </span>
                <span className="metrica-nota">
                  {formatearDiferencia(
                    resumen?.media_sobre_par_18 == null
                      ? null
                      : Math.round(resumen.media_sobre_par_18),
                  )}{' '}
                  sobre par
                </span>
              </article>
            </div>

            <section className="tarjeta panel-resumen">
              <span className="etiqueta-campo">Tu juego en cifras</span>

              <ul className="panel-lista">
                <li>
                  <span>Rondas jugadas</span>
                  <span className="texto-fuerte">{resumen?.total_rondas ?? 0}</span>
                </li>
                <li>
                  <span>Hoyos anotados</span>
                  <span className="texto-fuerte">{resumen?.total_hoyos ?? 0}</span>
                </li>
                <li>
                  <span>Mejor ronda</span>
                  <span className={`texto-fuerte ${claseDiferencia(resumen?.mejor_ronda_sobre_par)}`}>
                    {formatearDiferencia(resumen?.mejor_ronda_sobre_par)}
                  </span>
                </li>
                <li>
                  <span>Torneos</span>
                  <span className="texto-fuerte">{resumen?.total_torneos ?? 0}</span>
                </li>
                <li>
                  <span>Rondas en torneo</span>
                  <span className="texto-fuerte">{resumen?.rondas_en_torneo ?? 0}</span>
                </li>
              </ul>

              <div className="panel-atajos">
                <Link to="/estadisticas" className="btn btn-secundario btn-pequeno">
                  Estadísticas
                </Link>
                <Link to="/torneos" className="btn btn-secundario btn-pequeno">
                  Torneos
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
