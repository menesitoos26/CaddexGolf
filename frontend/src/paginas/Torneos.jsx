import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import Cargando from '../componentes/Cargando'
import EstadoVacio from '../componentes/EstadoVacio'
import { useNotificaciones } from '../hooks/useNotificaciones'
import { claseDiferencia, formatearDiferencia, formatearFecha, hoyIso } from '../utils/formato'
import './torneos.css'

const FORMULARIO_VACIO = {
  name: '',
  location: '',
  start_date: hoyIso(),
  end_date: '',
  final_position: '',
  notes: '',
}

export default function Torneos() {
  const [torneos, setTorneos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const { exito, error: avisarError } = useNotificaciones()

  const cargar = async () => {
    setCargando(true)
    try {
      setTorneos(await api.listarTorneos())
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar()
  }, [])

  const cambiar = (evento) => {
    const { name, value } = evento.target
    setFormulario((anterior) => ({ ...anterior, [name]: value }))
  }

  const crear = async (evento) => {
    evento.preventDefault()
    setError('')
    setGuardando(true)

    try {
      await api.crearTorneo({
        name: formulario.name.trim(),
        location: formulario.location.trim() || null,
        start_date: formulario.start_date,
        end_date: formulario.end_date || null,
        final_position: formulario.final_position ? Number(formulario.final_position) : null,
        notes: formulario.notes.trim() || null,
      })
      exito('Torneo creado.')
      setFormulario(FORMULARIO_VACIO)
      setFormularioAbierto(false)
      cargar()
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (torneo) => {
    const confirmado = window.confirm(
      `¿Borrar el torneo "${torneo.name}"? Sus rondas se conservarán, sólo dejarán de estar agrupadas.`,
    )
    if (!confirmado) return

    try {
      await api.borrarTorneo(torneo.id)
      exito('Torneo eliminado.')
      cargar()
    } catch (fallo) {
      avisarError(fallo.message)
    }
  }

  return (
    <div className="pagina">
      <div className="contenedor">
        <div className="pagina-cabecera">
          <div>
            <h1>Mis torneos</h1>
            <p>Agrupa tus rondas por competición y revisa cómo te fue.</p>
          </div>
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => setFormularioAbierto((abierto) => !abierto)}
          >
            {formularioAbierto ? 'Cancelar' : '+ Nuevo torneo'}
          </button>
        </div>

        {formularioAbierto && (
          <section className="tarjeta seccion">
            <h2 className="seccion-titulo">Nuevo torneo</h2>
            <form className="formulario" onSubmit={crear}>
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="name">Nombre del torneo</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={150}
                    placeholder="Ej. Copa de Primavera"
                    value={formulario.name}
                    onChange={cambiar}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="location">Lugar (opcional)</label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    maxLength={150}
                    value={formulario.location}
                    onChange={cambiar}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="start_date">Fecha de inicio</label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    required
                    value={formulario.start_date}
                    onChange={cambiar}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="end_date">Fecha de fin (opcional)</label>
                  <input
                    id="end_date"
                    name="end_date"
                    type="date"
                    min={formulario.start_date}
                    value={formulario.end_date}
                    onChange={cambiar}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="final_position">Puesto final (opcional)</label>
                  <input
                    id="final_position"
                    name="final_position"
                    type="number"
                    min="1"
                    placeholder="Ej. 4"
                    value={formulario.final_position}
                    onChange={cambiar}
                  />
                </div>
              </div>

              <div className="campo">
                <label htmlFor="notes">Notas (opcional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  maxLength={2000}
                  value={formulario.notes}
                  onChange={cambiar}
                />
              </div>

              {error && (
                <p className="mensaje-error" role="alert">
                  {error}
                </p>
              )}

              <div className="acciones-formulario">
                <button type="submit" className="btn btn-primario" disabled={guardando}>
                  {guardando ? 'Creando…' : 'Crear torneo'}
                </button>
              </div>
            </form>
          </section>
        )}

        {cargando ? (
          <Cargando texto="Cargando tus torneos…" />
        ) : torneos.length === 0 ? (
          <div className="tarjeta">
            <EstadoVacio
              icono="🏆"
              titulo="Aún no has creado ningún torneo"
              descripcion="Crea un torneo y luego asígnale las rondas que juegues en él para ver el resultado acumulado."
            />
          </div>
        ) : (
          <div className="rejilla-torneos">
            {torneos.map((torneo) => (
              <article className="torneo-tarjeta" key={torneo.id}>
                <div className="torneo-cabecera">
                  <h2>
                    <Link to={`/torneos/${torneo.id}`}>{torneo.name}</Link>
                  </h2>
                  {torneo.final_position && (
                    <span className="etiqueta">{torneo.final_position}º puesto</span>
                  )}
                </div>

                <p className="texto-tenue torneo-meta">
                  {formatearFecha(torneo.start_date)}
                  {torneo.end_date ? ` – ${formatearFecha(torneo.end_date)}` : ''}
                  {torneo.location ? ` · ${torneo.location}` : ''}
                </p>

                <div className="torneo-datos">
                  <div>
                    <span className="metrica-etiqueta">Rondas</span>
                    <strong>{torneo.rondas_jugadas}</strong>
                  </div>
                  <div>
                    <span className="metrica-etiqueta">Golpes</span>
                    <strong>{torneo.total_golpes ?? '—'}</strong>
                  </div>
                  <div>
                    <span className="metrica-etiqueta">Resultado</span>
                    <strong className={claseDiferencia(torneo.diferencia_par)}>
                      {formatearDiferencia(torneo.diferencia_par)}
                    </strong>
                  </div>
                </div>

                <div className="torneo-acciones">
                  <Link to={`/torneos/${torneo.id}`} className="btn-texto">
                    Ver detalle →
                  </Link>
                  <button
                    type="button"
                    className="btn btn-peligro btn-pequeno"
                    onClick={() => borrar(torneo)}
                  >
                    Borrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
