import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/cliente'
import Cargando from '../componentes/Cargando'
import EstadoVacio from '../componentes/EstadoVacio'
import { useNotificaciones } from '../hooks/useNotificaciones'
import { claseDiferencia, formatearDiferencia, formatearFecha } from '../utils/formato'

const POR_PAGINA = 15

export default function MisRondas() {
  const [rondas, setRondas] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const navegar = useNavigate()
  const { exito, error: avisarError } = useNotificaciones()

  const cargar = useCallback(async (paginaSolicitada) => {
    setCargando(true)
    setError('')
    try {
      const datos = await api.listarRondas({
        limit: POR_PAGINA,
        offset: paginaSolicitada * POR_PAGINA,
      })
      setRondas(datos.items)
      setTotal(datos.total)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // Carga inicial y al cambiar de página: es sincronización con el servidor,
    // no un cálculo derivable del estado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar(pagina)
  }, [cargar, pagina])

  const borrar = async (evento, ronda) => {
    evento.stopPropagation()

    const confirmado = window.confirm(
      `¿Seguro que quieres borrar la ronda del ${formatearFecha(ronda.played_on)} en ${
        ronda.course.name
      }? Esta acción no se puede deshacer.`,
    )
    if (!confirmado) return

    try {
      await api.borrarRonda(ronda.id)
      exito('Ronda eliminada.')
      // Si era la última de la página, retrocedemos una.
      const quedanEnPagina = rondas.length - 1
      const nuevaPagina = quedanEnPagina === 0 && pagina > 0 ? pagina - 1 : pagina
      setPagina(nuevaPagina)
      cargar(nuevaPagina)
    } catch (fallo) {
      avisarError(fallo.message)
    }
  }

  const ultimaPagina = Math.max(0, Math.ceil(total / POR_PAGINA) - 1)

  return (
    <div className="pagina">
      <div className="contenedor">
        <div className="pagina-cabecera">
          <div>
            <h1>Mis rondas</h1>
            <p>
              {total} {total === 1 ? 'vuelta registrada' : 'vueltas registradas'}
            </p>
          </div>
          <Link to="/rondas/nueva" className="btn btn-primario">
            + Registrar ronda
          </Link>
        </div>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        {cargando ? (
          <Cargando texto="Cargando tus rondas…" />
        ) : rondas.length === 0 ? (
          <div className="tarjeta">
            <EstadoVacio
              icono="📋"
              titulo="Todavía no hay rondas"
              descripcion="Cuando registres una vuelta aparecerá aquí, con su resultado y su tarjeta completa."
              accion={{ a: '/rondas/nueva', texto: 'Registrar mi primera ronda' }}
            />
          </div>
        ) : (
          <>
            <div className="tabla-envoltorio">
              <table className="tabla tabla-clicable">
                <thead>
                  <tr>
                    <th scope="col" className="alinear-izquierda">
                      Campo
                    </th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Hoyos</th>
                    <th scope="col">Par</th>
                    <th scope="col">Golpes</th>
                    <th scope="col">+/−</th>
                    <th scope="col">Torneo</th>
                    <th scope="col">
                      <span className="solo-lectores">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rondas.map((ronda) => (
                    <tr
                      key={ronda.id}
                      onClick={() => navegar(`/rondas/${ronda.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navegar(`/rondas/${ronda.id}`)}
                      tabIndex={0}
                    >
                      <td className="alinear-izquierda texto-fuerte">{ronda.course.name}</td>
                      <td className="texto-tenue">{formatearFecha(ronda.played_on)}</td>
                      <td className="texto-tenue">{ronda.holes_played}</td>
                      <td className="texto-tenue">{ronda.total_par}</td>
                      <td className="texto-fuerte">{ronda.total_strokes}</td>
                      <td className={claseDiferencia(ronda.diferencia_par)}>
                        {formatearDiferencia(ronda.diferencia_par)}
                      </td>
                      <td>
                        {ronda.tournament ? (
                          <span className="etiqueta">{ronda.tournament.name}</span>
                        ) : (
                          <span className="texto-tenue">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-peligro btn-pequeno"
                          onClick={(e) => borrar(e, ronda)}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ultimaPagina > 0 && (
              <div className="acciones-formulario" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  ← Anteriores
                </button>
                <span className="texto-tenue" style={{ alignSelf: 'center' }}>
                  Página {pagina + 1} de {ultimaPagina + 1}
                </span>
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  disabled={pagina >= ultimaPagina}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguientes →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
