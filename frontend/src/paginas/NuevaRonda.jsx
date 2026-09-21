import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/cliente'
import CapturaHoyo from '../componentes/CapturaHoyo'
import { useAuth } from '../hooks/useAuth'
import { useNotificaciones } from '../hooks/useNotificaciones'
import { claseDiferencia, formatearDiferencia, hoyIso } from '../utils/formato'
import './nuevaRonda.css'

// Recorrido tipo par 72: los 9 primeros suman 36 y los 9 siguientes también.
const PARES_ESTANDAR = [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4]

const CLIMAS = ['Soleado', 'Nublado', 'Viento', 'Lluvia', 'Calor', 'Frío']

function tarjetaInicial(numeroDeHoyos) {
  return Array.from({ length: numeroDeHoyos }, (_, indice) => ({
    hole_number: indice + 1,
    par: PARES_ESTANDAR[indice],
    strokes: '',
    putts: '',
    fairway_side: null,
    green_in_regulation: null,
  }))
}

/** En móvil el modo guiado es el que tiene sentido; en escritorio, la tabla. */
function modoInicial() {
  return window.matchMedia('(max-width: 980px)').matches ? 'guiado' : 'tarjeta'
}

export default function NuevaRonda() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const { exito, error: avisarError } = useNotificaciones()
  const { actualizarUsuario } = useAuth()

  const [hoyos, setHoyos] = useState(() => tarjetaInicial(18))
  const [modo, setModo] = useState(modoInicial)
  const [indiceHoyo, setIndiceHoyo] = useState(0)
  const [campo, setCampo] = useState({ name: '', city: '', country: '' })
  const [sugerencias, setSugerencias] = useState([])
  const [torneos, setTorneos] = useState([])
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [datos, setDatos] = useState({
    played_on: hoyIso(),
    tournament_id: parametros.get('torneo') || '',
    weather: '',
    notes: '',
  })

  useEffect(() => {
    api
      .listarTorneos()
      .then(setTorneos)
      .catch(() => setTorneos([])) // no es crítico: la ronda se puede guardar sin torneo
  }, [])

  // Buscamos campos mientras el usuario escribe, con una pequeña espera para
  // no lanzar una petición por cada tecla.
  useEffect(() => {
    const texto = campo.name.trim()
    if (texto.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSugerencias([])
      return undefined
    }

    const temporizador = setTimeout(async () => {
      try {
        setSugerencias(await api.buscarCampos(texto))
      } catch {
        setSugerencias([])
      }
    }, 350)

    return () => clearTimeout(temporizador)
  }, [campo.name])

  const cambiarNumeroDeHoyos = (cantidad) => {
    setHoyos((anteriores) => {
      const nueva = tarjetaInicial(cantidad)
      // Conservamos lo ya introducido al ampliar o reducir el recorrido.
      return nueva.map((hoyo, indice) => anteriores[indice] ?? hoyo)
    })
    setIndiceHoyo((actual) => Math.min(actual, cantidad - 1))
  }

  /**
   * `valor` puede ser un valor suelto o una función que recibe el hoyo actual.
   * La forma de función es imprescindible para los botones +/−: si se calculara
   * el nuevo valor fuera del setState, dos toques rápidos seguidos leerían el
   * mismo estado y uno de los dos se perdería.
   */
  const cambiarHoyo = (indice, propiedad, valor) => {
    setHoyos((anteriores) =>
      anteriores.map((hoyo, i) =>
        i === indice
          ? { ...hoyo, [propiedad]: typeof valor === 'function' ? valor(hoyo) : valor }
          : hoyo,
      ),
    )
  }

  const totales = useMemo(() => {
    const jugados = hoyos.filter((hoyo) => hoyo.strokes !== '' && hoyo.strokes > 0)
    const golpes = jugados.reduce((suma, hoyo) => suma + Number(hoyo.strokes), 0)
    const parJugado = jugados.reduce((suma, hoyo) => suma + Number(hoyo.par), 0)
    const putts = jugados.reduce((suma, hoyo) => suma + (Number(hoyo.putts) || 0), 0)

    return {
      hoyosJugados: jugados.length,
      golpes,
      parTotal: hoyos.reduce((suma, hoyo) => suma + Number(hoyo.par), 0),
      parJugado,
      putts,
      diferencia: jugados.length > 0 ? golpes - parJugado : null,
    }
  }, [hoyos])

  const guardar = async (evento) => {
    evento?.preventDefault()
    setError('')

    if (!campo.name.trim()) {
      setError('Indica en qué campo has jugado.')
      return
    }

    const primeroSinAnotar = hoyos.findIndex(
      (hoyo) => hoyo.strokes === '' || Number(hoyo.strokes) < 1,
    )
    if (primeroSinAnotar !== -1) {
      const pendientes = hoyos.filter((h) => h.strokes === '' || Number(h.strokes) < 1).length
      setError(
        `Falta anotar los golpes en ${pendientes} ${pendientes === 1 ? 'hoyo' : 'hoyos'}. ` +
          'Si no jugaste el recorrido entero, cambia el recorrido a 9 hoyos.',
      )
      // Llevamos al jugador directamente al primer hoyo que le falta.
      setIndiceHoyo(primeroSinAnotar)
      return
    }

    setGuardando(true)
    try {
      const respuesta = await api.crearRonda({
        course: {
          name: campo.name.trim(),
          city: campo.city.trim() || null,
          country: campo.country.trim() || null,
        },
        played_on: datos.played_on,
        tournament_id: datos.tournament_id ? Number(datos.tournament_id) : null,
        weather: datos.weather || null,
        notes: datos.notes.trim() || null,
        holes: hoyos.map((hoyo) => ({
          hole_number: hoyo.hole_number,
          par: Number(hoyo.par),
          strokes: Number(hoyo.strokes),
          putts: hoyo.putts === '' ? null : Number(hoyo.putts),
          fairway_side: hoyo.fairway_side,
          green_in_regulation: hoyo.green_in_regulation,
        })),
      })

      actualizarUsuario({ handicap: respuesta.handicap })
      exito('¡Ronda guardada! Tu hándicap se ha actualizado.')
      navegar(`/rondas/${respuesta.ronda.id}`)
    } catch (fallo) {
      setError(fallo.message)
      avisarError('No se ha podido guardar la ronda.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pagina">
      <div className="contenedor">
        <div className="pagina-cabecera">
          <div>
            <h1>Nueva ronda</h1>
            <p>Anota tu tarjeta hoyo a hoyo. Los totales se calculan solos.</p>
          </div>
        </div>

        <form onSubmit={guardar}>
          <section className="tarjeta seccion">
            <h2 className="seccion-titulo">Datos de la ronda</h2>

            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="campo-nombre">Campo de golf</label>
                <input
                  id="campo-nombre"
                  type="text"
                  list="sugerencias-campos"
                  placeholder="Ej. Club de Campo Villa de Madrid"
                  value={campo.name}
                  onChange={(e) => setCampo({ ...campo, name: e.target.value })}
                  required
                />
                <datalist id="sugerencias-campos">
                  {sugerencias.map((sugerencia) => (
                    <option
                      key={`${sugerencia.name}-${sugerencia.city ?? ''}`}
                      value={sugerencia.name}
                    >
                      {[sugerencia.city, sugerencia.country].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="campo">
                <label htmlFor="campo-ciudad">Ciudad (opcional)</label>
                <input
                  id="campo-ciudad"
                  type="text"
                  value={campo.city}
                  onChange={(e) => setCampo({ ...campo, city: e.target.value })}
                />
              </div>

              <div className="campo">
                <label htmlFor="fecha">Fecha</label>
                <input
                  id="fecha"
                  type="date"
                  max={hoyIso()}
                  value={datos.played_on}
                  onChange={(e) => setDatos({ ...datos, played_on: e.target.value })}
                  required
                />
              </div>

              <div className="campo">
                <label htmlFor="torneo">Torneo (opcional)</label>
                <select
                  id="torneo"
                  value={datos.tournament_id}
                  onChange={(e) => setDatos({ ...datos, tournament_id: e.target.value })}
                >
                  <option value="">Ronda suelta</option>
                  {torneos.map((torneo) => (
                    <option key={torneo.id} value={torneo.id}>
                      {torneo.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <label htmlFor="clima">Condiciones (opcional)</label>
                <select
                  id="clima"
                  value={datos.weather}
                  onChange={(e) => setDatos({ ...datos, weather: e.target.value })}
                >
                  <option value="">Sin especificar</option>
                  {CLIMAS.map((clima) => (
                    <option key={clima} value={clima}>
                      {clima}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <label htmlFor="recorrido">Recorrido</label>
                <select
                  id="recorrido"
                  value={hoyos.length}
                  onChange={(e) => cambiarNumeroDeHoyos(Number(e.target.value))}
                >
                  <option value={9}>9 hoyos</option>
                  <option value={18}>18 hoyos</option>
                </select>
              </div>
            </div>
          </section>

          <section className="marcador">
            <div className="marcador-dato">
              <span>Par del recorrido</span>
              <strong>{totales.parTotal}</strong>
            </div>
            <div className="marcador-dato">
              <span>Tus golpes</span>
              <strong>{totales.golpes}</strong>
            </div>
            <div className="marcador-dato">
              <span>Resultado</span>
              <strong className={claseDiferencia(totales.diferencia)}>
                {formatearDiferencia(totales.diferencia)}
              </strong>
            </div>
            <div className="marcador-dato">
              <span>Hoyos anotados</span>
              <strong>
                {totales.hoyosJugados}/{hoyos.length}
              </strong>
            </div>
          </section>

          <section className="seccion">
            <div className="tarjeta-encabezado">
              <h2 className="seccion-titulo">
                {modo === 'guiado' ? 'Registro hoyo a hoyo' : 'Tarjeta'}
              </h2>

              <div className="segmentado modo-captura">
                <button
                  type="button"
                  aria-pressed={modo === 'guiado'}
                  onClick={() => setModo('guiado')}
                >
                  Hoyo a hoyo
                </button>
                <button
                  type="button"
                  aria-pressed={modo === 'tarjeta'}
                  onClick={() => setModo('tarjeta')}
                >
                  Tarjeta
                </button>
              </div>
            </div>

            {modo === 'guiado' ? (
              <CapturaHoyo
                hoyos={hoyos}
                indice={indiceHoyo}
                campo={campo.name}
                onCambiarHoyo={cambiarHoyo}
                onIrA={(i) => setIndiceHoyo(Math.max(0, Math.min(hoyos.length - 1, i)))}
                onGuardar={guardar}
                guardando={guardando}
              />
            ) : (
              <>
                <div className="tarjeta-detalle-conmutador">
                  <button
                    type="button"
                    className="btn-texto"
                    onClick={() => setDetalleAbierto((abierto) => !abierto)}
                    aria-expanded={detalleAbierto}
                  >
                    {detalleAbierto
                      ? '− Ocultar putts y calles'
                      : '+ Añadir putts, calles y greenes'}
                  </button>
                </div>

                <div className="tabla-envoltorio">
              <table className="tabla tabla-tarjeta">
                <thead>
                  <tr>
                    <th scope="col">Hoyo</th>
                    <th scope="col">Par</th>
                    <th scope="col">Golpes</th>
                    {detalleAbierto && (
                      <>
                        <th scope="col">Putts</th>
                        <th scope="col">Calle</th>
                        <th scope="col">Green</th>
                      </>
                    )}
                    <th scope="col">+/−</th>
                  </tr>
                </thead>
                <tbody>
                  {hoyos.map((hoyo, indice) => {
                    const diferencia =
                      hoyo.strokes === '' ? null : Number(hoyo.strokes) - Number(hoyo.par)

                    return (
                      <tr key={hoyo.hole_number}>
                        <th scope="row" className="celda-hoyo">
                          {hoyo.hole_number}
                        </th>
                        <td>
                          <select
                            value={hoyo.par}
                            onChange={(e) => cambiarHoyo(indice, 'par', Number(e.target.value))}
                            aria-label={`Par del hoyo ${hoyo.hole_number}`}
                          >
                            {[3, 4, 5, 6].map((par) => (
                              <option key={par} value={par}>
                                {par}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            inputMode="numeric"
                            placeholder="—"
                            className={hoyo.strokes !== '' ? 'anotado' : ''}
                            value={hoyo.strokes}
                            onChange={(e) => cambiarHoyo(indice, 'strokes', e.target.value)}
                            aria-label={`Golpes en el hoyo ${hoyo.hole_number}`}
                          />
                        </td>

                        {detalleAbierto && (
                          <>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="15"
                                inputMode="numeric"
                                placeholder="—"
                                value={hoyo.putts}
                                onChange={(e) => cambiarHoyo(indice, 'putts', e.target.value)}
                                aria-label={`Putts en el hoyo ${hoyo.hole_number}`}
                              />
                            </td>
                            <td>
                              <select
                                className="celda-calle"
                                // En los par 3 se entra al green de salida.
                                disabled={Number(hoyo.par) < 4}
                                value={hoyo.fairway_side ?? ''}
                                onChange={(e) =>
                                  cambiarHoyo(indice, 'fairway_side', e.target.value || null)
                                }
                                aria-label={`Calle en el hoyo ${hoyo.hole_number}`}
                              >
                                <option value="">—</option>
                                <option value="izquierda">Izq.</option>
                                <option value="centro">Calle</option>
                                <option value="derecha">Der.</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                className="casilla"
                                checked={hoyo.green_in_regulation === true}
                                onChange={(e) =>
                                  cambiarHoyo(indice, 'green_in_regulation', e.target.checked)
                                }
                                aria-label={`Green en regulación en el hoyo ${hoyo.hole_number}`}
                              />
                            </td>
                          </>
                        )}

                        <td className={claseDiferencia(diferencia)}>
                          {diferencia === null ? '—' : formatearDiferencia(diferencia)}
                        </td>
                      </tr>
                    )
                  })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="tarjeta seccion">
            <div className="campo">
              <label htmlFor="notas">Notas de la ronda (opcional)</label>
              <textarea
                id="notas"
                maxLength={2000}
                placeholder="Qué funcionó, qué no, con qué palos fallaste…"
                value={datos.notes}
                onChange={(e) => setDatos({ ...datos, notes: e.target.value })}
              />
            </div>
          </section>

          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <div className="acciones-formulario">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => navegar('/panel')}
              disabled={guardando}
            >
              Cancelar
            </button>
            {/* En modo guiado el botón de guardar vive en el pie de la captura. */}
            {modo === 'tarjeta' && (
              <button type="submit" className="btn btn-primario" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar ronda'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
