import { useEffect, useRef } from 'react'
import { claseDiferencia, formatearDiferencia } from '../utils/formato'
import './capturaHoyo.css'

const LADOS = [
  { valor: 'izquierda', texto: 'Izq.' },
  { valor: 'centro', texto: 'Dio calle' },
  { valor: 'derecha', texto: 'Der.' },
]

const GOLPES_MIN = 1
const GOLPES_MAX = 20

/**
 * Registro guiado hoyo a hoyo, pensado para usarse de pie en el campo:
 * objetivos grandes, una sola decisión por bloque y cero teclado.
 */
export default function CapturaHoyo({
  hoyos,
  indice,
  campo,
  onCambiarHoyo,
  onIrA,
  onGuardar,
  guardando,
}) {
  const hoyo = hoyos[indice]
  const tira = useRef(null)
  const esUltimo = indice === hoyos.length - 1

  // Al cambiar de hoyo, centramos su ficha en la tira.
  useEffect(() => {
    const activa = tira.current?.querySelector('[data-activa="true"]')
    activa?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [indice])

  // Los totales sólo cuentan los hoyos ya anotados.
  const anotados = hoyos.filter((h) => h.strokes !== '')
  const acumulado = anotados.reduce(
    (suma, h) => suma + (Number(h.strokes) - Number(h.par)),
    0,
  )

  const golpes = hoyo.strokes === '' ? Number(hoyo.par) : Number(hoyo.strokes)
  const sinAnotar = hoyo.strokes === ''
  const putts = hoyo.putts === '' ? 0 : Number(hoyo.putts)

  // Los +/− se calculan dentro del actualizador, no fuera: así dos toques
  // rápidos seguidos suman dos y no uno (React agrupa los eventos).
  const cambiarGolpes = (delta) => {
    onCambiarHoyo(indice, 'strokes', (actual) => {
      const desde = actual.strokes === '' ? Number(actual.par) : Number(actual.strokes)
      return Math.min(GOLPES_MAX, Math.max(GOLPES_MIN, desde + delta))
    })
  }

  const cambiarPutts = (delta) => {
    onCambiarHoyo(indice, 'putts', (actual) => {
      // Los putts nunca pueden superar a los golpes: sería una tarjeta imposible.
      const tope = actual.strokes === '' ? Number(actual.par) : Number(actual.strokes)
      const desde = actual.putts === '' ? 0 : Number(actual.putts)
      return Math.min(tope, Math.max(0, desde + delta))
    })
  }

  const alternar = (propiedad, valor) => {
    onCambiarHoyo(indice, propiedad, hoyo[propiedad] === valor ? null : valor)
  }

  return (
    <div className="captura">
      <header className="captura-cabecera">
        <div>
          <span className="captura-campo">{campo || 'Sin campo seleccionado'}</span>
          <h2>
            Hoyo {hoyo.hole_number} · par {hoyo.par}
          </h2>
        </div>
        <span className={`captura-acumulado ${claseDiferencia(anotados.length ? acumulado : null)}`}>
          {anotados.length ? formatearDiferencia(acumulado) : '—'}
        </span>
      </header>

      <div className="captura-tira" ref={tira} role="tablist" aria-label="Hoyos de la ronda">
        {hoyos.map((h, i) => {
          const jugado = h.strokes !== ''
          const diferencia = jugado ? Number(h.strokes) - Number(h.par) : null

          return (
            <button
              key={h.hole_number}
              type="button"
              role="tab"
              aria-selected={i === indice}
              data-activa={i === indice}
              className={`captura-ficha ${i === indice ? 'activa' : ''} ${
                jugado ? 'jugada' : 'pendiente'
              }`}
              onClick={() => onIrA(i)}
            >
              <span className="captura-ficha-numero">{h.hole_number}</span>
              {i !== indice && (
                <span className="captura-ficha-diff">
                  {jugado ? formatearDiferencia(diferencia) : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="captura-cuerpo">
        <section className="captura-bloque">
          <span className="etiqueta-campo">Golpes</span>
          <div className="captura-contador">
            <button
              type="button"
              className="captura-paso"
              onClick={() => cambiarGolpes(-1)}
              disabled={golpes <= GOLPES_MIN}
              aria-label="Un golpe menos"
            >
              −
            </button>
            <span className={`captura-cifra ${sinAnotar ? 'sin-anotar' : ''}`}>{golpes}</span>
            <button
              type="button"
              className="captura-paso captura-paso-principal"
              onClick={() => cambiarGolpes(1)}
              disabled={golpes >= GOLPES_MAX}
              aria-label="Un golpe más"
            >
              +
            </button>
          </div>
          {sinAnotar && <p className="captura-pista">Toca + o − para anotar este hoyo.</p>}
        </section>

        <section className="captura-bloque captura-bloque-fila">
          <span className="etiqueta-campo">Putts</span>
          <div className="captura-contador captura-contador-pequeno">
            <button
              type="button"
              className="captura-paso captura-paso-pequeno"
              onClick={() => cambiarPutts(-1)}
              disabled={putts <= 0}
              aria-label="Un putt menos"
            >
              −
            </button>
            <span className="captura-cifra-pequena">{hoyo.putts === '' ? '—' : putts}</span>
            <button
              type="button"
              className="captura-paso captura-paso-pequeno captura-paso-borde"
              onClick={() => cambiarPutts(1)}
              disabled={putts >= golpes}
              aria-label="Un putt más"
            >
              +
            </button>
          </div>
        </section>

        <section className="captura-bloque-opciones">
          <span className="etiqueta-campo">Green en regulación</span>
          <div className="captura-opciones">
            <button
              type="button"
              className={`captura-opcion ${hoyo.green_in_regulation === true ? 'elegida' : ''}`}
              onClick={() => alternar('green_in_regulation', true)}
            >
              Sí
            </button>
            <button
              type="button"
              className={`captura-opcion ${hoyo.green_in_regulation === false ? 'elegida' : ''}`}
              onClick={() => alternar('green_in_regulation', false)}
            >
              No
            </button>
          </div>
        </section>

        {/* En los par 3 se entra al green de salida: la calle no se juega. */}
        {Number(hoyo.par) >= 4 && (
          <section className="captura-bloque-opciones">
            <span className="etiqueta-campo">Calle</span>
            <div className="captura-opciones">
              {LADOS.map((lado) => (
                <button
                  key={lado.valor}
                  type="button"
                  className={`captura-opcion ${lado.valor === 'centro' ? 'ancha' : ''} ${
                    hoyo.fairway_side === lado.valor ? 'elegida' : ''
                  }`}
                  onClick={() => alternar('fairway_side', lado.valor)}
                >
                  {lado.texto}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="captura-pie">
        <button
          type="button"
          className="captura-atras"
          onClick={() => onIrA(indice - 1)}
          disabled={indice === 0}
          aria-label="Hoyo anterior"
        >
          ‹
        </button>

        {esUltimo ? (
          <button
            type="button"
            className="btn btn-primario captura-siguiente"
            onClick={onGuardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar ronda'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primario captura-siguiente"
            onClick={() => onIrA(indice + 1)}
          >
            Hoyo {hoyos[indice + 1].hole_number} →
          </button>
        )}
      </footer>
    </div>
  )
}
