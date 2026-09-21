import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/cliente'
import Cargando from '../componentes/Cargando'
import { useNotificaciones } from '../hooks/useNotificaciones'
import {
  claseDiferencia,
  formatearDiferencia,
  formatearFecha,
  nombreResultadoHoyo,
} from '../utils/formato'
import './detalleRonda.css'

/** Acierto de calle o green: voltio si sí, apagado si no. */
function marcaAcierto(valor) {
  if (valor === null) return <span className="texto-tenue">—</span>
  return valor ? (
    <span className="detalle-acierto">✓</span>
  ) : (
    <span className="detalle-fallo">✗</span>
  )
}

/** Calle: el acierto en voltio, el fallo indicando hacia qué lado se fue. */
function marcaCalle(lado) {
  if (!lado) return <span className="texto-tenue">—</span>
  if (lado === 'centro') return <span className="detalle-acierto">✓</span>
  return <span className="detalle-fallo">{lado === 'izquierda' ? '← izq' : 'der →'}</span>
}

/** Resumen de una mitad del recorrido (ida / vuelta). */
function bloqueDeHoyos(hoyos, desde, hasta) {
  const seleccion = hoyos.filter((h) => h.hole_number >= desde && h.hole_number <= hasta)
  if (seleccion.length === 0) return null
  return {
    hoyos: seleccion,
    par: seleccion.reduce((suma, h) => suma + h.par, 0),
    golpes: seleccion.reduce((suma, h) => suma + h.strokes, 0),
  }
}

export default function DetalleRonda() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { exito, error: avisarError } = useNotificaciones()

  const [ronda, setRonda] = useState(null)
  const [torneos, setTorneos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false

    api
      .detalleRonda(id)
      .then((datos) => !cancelado && setRonda(datos))
      .catch((fallo) => !cancelado && setError(fallo.message))
      .finally(() => !cancelado && setCargando(false))

    api
      .listarTorneos()
      .then((datos) => !cancelado && setTorneos(datos))
      .catch(() => {})

    return () => {
      cancelado = true
    }
  }, [id])

  const cambiarTorneo = async (valor) => {
    try {
      const actualizada = await api.actualizarRonda(ronda.id,
        valor ? { tournament_id: Number(valor) } : { quitar_torneo: true },
      )
      setRonda(actualizada)
      exito(valor ? 'Ronda asignada al torneo.' : 'Ronda desvinculada del torneo.')
    } catch (fallo) {
      avisarError(fallo.message)
    }
  }

  const borrar = async () => {
    if (!window.confirm('¿Seguro que quieres borrar esta ronda? No se puede deshacer.')) return
    try {
      await api.borrarRonda(ronda.id)
      exito('Ronda eliminada.')
      navegar('/rondas')
    } catch (fallo) {
      avisarError(fallo.message)
    }
  }

  if (cargando) return <Cargando texto="Cargando la tarjeta…" />

  if (error || !ronda) {
    return (
      <div className="pagina">
        <div className="contenedor">
          <div className="estado-vacio" style={{ paddingTop: 70 }}>
            <span className="estado-vacio-icono" aria-hidden="true">
              🔍
            </span>
            <h3>No hemos encontrado esta ronda</h3>
            <p>{error || 'Puede que la hayas borrado o que no sea tuya.'}</p>
            <Link to="/rondas" className="btn btn-primario">
              Volver a mis rondas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const ida = bloqueDeHoyos(ronda.holes, 1, 9)
  const vuelta = bloqueDeHoyos(ronda.holes, 10, 18)
  const conPutts = ronda.holes.some((hoyo) => hoyo.putts !== null)
  const conCalles = ronda.holes.some((hoyo) => hoyo.fairway_side !== null)
  const conGreenes = ronda.holes.some((hoyo) => hoyo.green_in_regulation !== null)

  return (
    <div className="pagina">
      <div className="contenedor">
        <div className="pagina-cabecera">
          <div>
            <Link to="/rondas" className="btn-texto">
              ← Mis rondas
            </Link>
            <h1>{ronda.course.name}</h1>
            <p>
              {formatearFecha(ronda.played_on)} · {ronda.holes_played} hoyos
              {ronda.course.city ? ` · ${ronda.course.city}` : ''}
              {ronda.weather ? ` · ${ronda.weather}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-peligro" onClick={borrar}>
            Borrar ronda
          </button>
        </div>

        <section className="rejilla-metricas seccion">
          <article className="metrica">
            <span className="metrica-etiqueta">Golpes</span>
            <span className="metrica-valor">{ronda.total_strokes}</span>
            <span className="metrica-nota">Par del recorrido: {ronda.total_par}</span>
          </article>
          <article className="metrica">
            <span className="metrica-etiqueta">Resultado</span>
            <span className={`metrica-valor ${claseDiferencia(ronda.diferencia_par)}`}>
              {formatearDiferencia(ronda.diferencia_par)}
            </span>
            <span className="metrica-nota">Respecto al par</span>
          </article>
          <article className="metrica">
            <span className="metrica-etiqueta">Putts</span>
            <span className="metrica-valor">{ronda.total_putts ?? '—'}</span>
            <span className="metrica-nota">
              {ronda.total_putts
                ? `${(ronda.total_putts / ronda.holes_played).toFixed(2)} por hoyo`
                : 'No registrados'}
            </span>
          </article>
          <article className="metrica">
            <span className="metrica-etiqueta">Torneo</span>
            <select
              className="detalle-selector-torneo"
              value={ronda.tournament?.id ?? ''}
              onChange={(e) => cambiarTorneo(e.target.value)}
              aria-label="Torneo al que pertenece esta ronda"
            >
              <option value="">Ronda suelta</option>
              {torneos.map((torneo) => (
                <option key={torneo.id} value={torneo.id}>
                  {torneo.name}
                </option>
              ))}
            </select>
          </article>
        </section>

        <section className="seccion">
          <h2 className="seccion-titulo">Tarjeta hoyo a hoyo</h2>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Hoyo</th>
                  <th scope="col">Par</th>
                  <th scope="col">Golpes</th>
                  <th scope="col">+/−</th>
                  <th scope="col" className="alinear-izquierda">
                    Resultado
                  </th>
                  {conPutts && <th scope="col">Putts</th>}
                  {conCalles && <th scope="col">Calle</th>}
                  {conGreenes && <th scope="col">Green</th>}
                </tr>
              </thead>
              <tbody>
                {ronda.holes.map((hoyo) => {
                  const diferencia = hoyo.strokes - hoyo.par
                  return (
                    <tr key={hoyo.hole_number}>
                      <th scope="row" className="celda-numero-hoyo">
                        {hoyo.hole_number}
                      </th>
                      <td className="texto-tenue">{hoyo.par}</td>
                      <td className="texto-fuerte">{hoyo.strokes}</td>
                      <td className={claseDiferencia(diferencia)}>
                        {formatearDiferencia(diferencia)}
                      </td>
                      <td className="alinear-izquierda">
                        {nombreResultadoHoyo(hoyo.strokes, hoyo.par)}
                      </td>
                      {conPutts && <td className="texto-tenue">{hoyo.putts ?? '—'}</td>}
                      {conCalles && <td>{marcaCalle(hoyo.fairway_side)}</td>}
                      {conGreenes && <td>{marcaAcierto(hoyo.green_in_regulation)}</td>}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {ida && vuelta && (
                  <>
                    <tr>
                      <th scope="row" className="celda-numero-hoyo">
                        Ida
                      </th>
                      <td className="texto-tenue">{ida.par}</td>
                      <td className="texto-fuerte">{ida.golpes}</td>
                      <td className={claseDiferencia(ida.golpes - ida.par)}>
                        {formatearDiferencia(ida.golpes - ida.par)}
                      </td>
                      <td colSpan={10} />
                    </tr>
                    <tr>
                      <th scope="row" className="celda-numero-hoyo">
                        Vuelta
                      </th>
                      <td className="texto-tenue">{vuelta.par}</td>
                      <td className="texto-fuerte">{vuelta.golpes}</td>
                      <td className={claseDiferencia(vuelta.golpes - vuelta.par)}>
                        {formatearDiferencia(vuelta.golpes - vuelta.par)}
                      </td>
                      <td colSpan={10} />
                    </tr>
                  </>
                )}
                <tr className="fila-total">
                  <th scope="row" className="celda-numero-hoyo">
                    Total
                  </th>
                  <td>{ronda.total_par}</td>
                  <td>{ronda.total_strokes}</td>
                  <td className={claseDiferencia(ronda.diferencia_par)}>
                    {formatearDiferencia(ronda.diferencia_par)}
                  </td>
                  <td colSpan={10} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {ronda.notes && (
          <section className="tarjeta seccion">
            <h2 className="seccion-titulo">Notas</h2>
            <p className="detalle-notas">{ronda.notes}</p>
          </section>
        )}
      </div>
    </div>
  )
}
