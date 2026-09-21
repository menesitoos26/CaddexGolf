import { Link } from 'react-router-dom'

export default function EstadoVacio({ icono = '⛳', titulo, descripcion, accion }) {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio-icono" aria-hidden="true">
        {icono}
      </div>
      <h3>{titulo}</h3>
      {descripcion && <p>{descripcion}</p>}
      {accion && (
        <Link to={accion.a} className="btn btn-primario">
          {accion.texto}
        </Link>
      )}
    </div>
  )
}
