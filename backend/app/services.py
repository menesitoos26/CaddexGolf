"""Lógica de negocio: campos, hándicap y estadísticas.

Se mantiene fuera de los routers para que los endpoints sean sólo "traducción"
HTTP y esta parte se pueda probar de forma aislada.
"""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.handicap import RondaParaHandicap, calcular_handicap
from app.models import Course, Round, Tournament, User
from app.schemas import (
    CampoBase,
    DispersionCalle,
    EstadisticasRespuesta,
    MediaPorPar,
    PuntoEvolucion,
    RendimientoCampo,
    RepartoResultados,
    ResumenEstadisticas,
)

MAXIMO_RONDAS_EVOLUCION = 30


# ------------------------------------------------------------------- campos


def _normalizar(texto: str | None) -> str | None:
    if texto is None:
        return None
    limpio = " ".join(texto.split())
    return limpio or None


def obtener_o_crear_campo(db: Session, datos: CampoBase) -> Course:
    """Reutiliza el campo si ya existe (mismo nombre y ciudad) o lo crea."""
    nombre = _normalizar(datos.name) or datos.name
    ciudad = _normalizar(datos.city)

    consulta = select(Course).where(Course.name == nombre)
    consulta = consulta.where(Course.city == ciudad) if ciudad else consulta.where(
        Course.city.is_(None)
    )

    campo = db.scalars(consulta).first()
    if campo is not None:
        return campo

    campo = Course(name=nombre, city=ciudad, country=_normalizar(datos.country))
    db.add(campo)
    db.flush()  # necesitamos el id antes del commit
    return campo


# ------------------------------------------------------------------ hándicap


def _ronda_a_datos_handicap(ronda: Round) -> RondaParaHandicap:
    return RondaParaHandicap(
        holes_played=ronda.holes_played,
        total_par=ronda.total_par,
        hoyos=tuple((h.par, h.strokes) for h in ronda.holes),
        course_rating=float(ronda.course_rating) if ronda.course_rating is not None else None,
        slope_rating=ronda.slope_rating,
    )


def recalcular_handicap(db: Session, usuario: User) -> float | None:
    """Recalcula y persiste el hándicap del usuario con sus últimas 20 rondas."""
    rondas = db.scalars(
        select(Round)
        .where(Round.user_id == usuario.id)
        .options(selectinload(Round.holes))
        .order_by(Round.played_on.desc(), Round.id.desc())
        .limit(20)
    ).all()

    handicap = calcular_handicap([_ronda_a_datos_handicap(r) for r in rondas])
    usuario.handicap = handicap
    db.add(usuario)
    return handicap


# -------------------------------------------------------------- estadísticas


def _clasificar_hoyo(reparto: RepartoResultados, diferencia: int) -> None:
    if diferencia <= -2:
        reparto.eagles += 1
    elif diferencia == -1:
        reparto.birdies += 1
    elif diferencia == 0:
        reparto.pares += 1
    elif diferencia == 1:
        reparto.bogeys += 1
    elif diferencia == 2:
        reparto.dobles += 1
    else:
        reparto.triples_o_mas += 1
    reparto.total_hoyos += 1


def _media(valores: list[float]) -> float | None:
    return round(sum(valores) / len(valores), 2) if valores else None


def calcular_estadisticas(db: Session, usuario: User) -> EstadisticasRespuesta:
    """Agrega todas las métricas que consume el panel de estadísticas."""
    rondas = db.scalars(
        select(Round)
        .where(Round.user_id == usuario.id)
        .options(selectinload(Round.holes), selectinload(Round.course))
        .order_by(Round.played_on.asc(), Round.id.asc())
    ).all()

    total_torneos = db.scalar(
        select(func.count(Tournament.id)).where(Tournament.user_id == usuario.id)
    ) or 0

    resumen = ResumenEstadisticas(
        handicap=float(usuario.handicap) if usuario.handicap is not None else None,
        total_torneos=total_torneos,
    )
    reparto = RepartoResultados()
    dispersion = DispersionCalle()

    if not rondas:
        return EstadisticasRespuesta(resumen=resumen, reparto=reparto)

    diferencias_18: list[float] = []
    golpes_18: list[float] = []
    putts_18: list[float] = []
    diferencias_absolutas: list[int] = []

    calles_intentadas = calles_acertadas = 0
    greenes_intentados = greenes_acertados = 0

    por_par: dict[int, list[int]] = defaultdict(list)
    por_campo: dict[str, list[int]] = defaultdict(list)
    evolucion: list[PuntoEvolucion] = []

    for ronda in rondas:
        if ronda.holes_played <= 0:
            continue

        factor = 18 / ronda.holes_played
        diferencia = ronda.diferencia_par

        resumen.total_hoyos += ronda.holes_played
        diferencias_absolutas.append(diferencia)
        diferencias_18.append(diferencia * factor)
        golpes_18.append(ronda.total_strokes * factor)
        if ronda.total_putts is not None:
            putts_18.append(ronda.total_putts * factor)

        por_campo[ronda.course.name].append(diferencia)

        evolucion.append(
            PuntoEvolucion(
                round_id=ronda.id,
                played_on=ronda.played_on,
                campo=ronda.course.name,
                holes_played=ronda.holes_played,
                diferencia_par=diferencia,
                diferencia_par_18=round(diferencia * factor, 1),
            )
        )

        for hoyo in ronda.holes:
            _clasificar_hoyo(reparto, hoyo.strokes - hoyo.par)
            por_par[hoyo.par].append(hoyo.strokes)

            # La calle sólo se cuenta en hoyos de par 4 y 5 (en par 3 no aplica).
            if hoyo.par >= 4 and hoyo.fairway_hit is not None:
                calles_intentadas += 1
                calles_acertadas += int(hoyo.fairway_hit)

                if hoyo.fairway_side is not None:
                    lado = hoyo.fairway_side
                    setattr(dispersion, lado, getattr(dispersion, lado) + 1)
                    dispersion.total += 1

            if hoyo.green_in_regulation is not None:
                greenes_intentados += 1
                greenes_acertados += int(hoyo.green_in_regulation)

    resumen.total_rondas = len(rondas)
    resumen.rondas_en_torneo = sum(1 for r in rondas if r.tournament_id is not None)
    resumen.media_golpes_18 = _media(golpes_18)
    resumen.media_sobre_par_18 = _media(diferencias_18)
    resumen.media_putts_18 = _media(putts_18)
    resumen.mejor_ronda_sobre_par = min(diferencias_absolutas) if diferencias_absolutas else None
    resumen.peor_ronda_sobre_par = max(diferencias_absolutas) if diferencias_absolutas else None

    if calles_intentadas:
        resumen.porcentaje_calles = round(calles_acertadas / calles_intentadas * 100, 1)
    if greenes_intentados:
        resumen.porcentaje_greenes = round(greenes_acertados / greenes_intentados * 100, 1)

    lista_por_par = [
        MediaPorPar(
            par=par,
            hoyos_jugados=len(golpes),
            media_golpes=round(sum(golpes) / len(golpes), 2),
            media_sobre_par=round(sum(golpes) / len(golpes) - par, 2),
        )
        for par, golpes in sorted(por_par.items())
    ]

    lista_por_campo = sorted(
        (
            RendimientoCampo(
                campo=nombre,
                rondas=len(difs),
                media_sobre_par=round(sum(difs) / len(difs), 2),
                mejor_sobre_par=min(difs),
            )
            for nombre, difs in por_campo.items()
        ),
        key=lambda c: (-c.rondas, c.media_sobre_par),
    )

    return EstadisticasRespuesta(
        resumen=resumen,
        reparto=reparto,
        dispersion_calle=dispersion,
        por_par=lista_por_par,
        evolucion=evolucion[-MAXIMO_RONDAS_EVOLUCION:],
        por_campo=lista_por_campo,
    )


# ---------------------------------------------------------- resumen de torneo


def resumen_torneo(db: Session, torneo: Tournament) -> dict:
    """Totales agregados de las rondas asociadas a un torneo."""
    filas = db.execute(
        select(Round.total_strokes, Round.total_par).where(Round.tournament_id == torneo.id)
    ).all()

    if not filas:
        return {
            "rondas_jugadas": 0,
            "total_golpes": None,
            "total_par": None,
            "diferencia_par": None,
        }

    total_golpes = sum(f.total_strokes for f in filas)
    total_par = sum(f.total_par for f in filas)
    return {
        "rondas_jugadas": len(filas),
        "total_golpes": total_golpes,
        "total_par": total_par,
        "diferencia_par": total_golpes - total_par,
    }
