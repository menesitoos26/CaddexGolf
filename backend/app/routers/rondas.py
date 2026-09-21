"""Registro y consulta de rondas de golf."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import SesionBD, UsuarioActual
from app.models import Round, RoundHole, Tournament
from app.schemas import (
    ActualizarRonda,
    CrearRonda,
    PaginaRondas,
    RondaDetalle,
    RondaGuardadaRespuesta,
    RondaResumen,
)
from app.services import obtener_o_crear_campo, recalcular_handicap

router = APIRouter(prefix="/rondas", tags=["Rondas"])

RONDA_NO_ENCONTRADA = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Ronda no encontrada."
)


def _cargar_ronda(db: SesionBD, ronda_id: int, user_id: int) -> Round:
    """Carga una ronda comprobando SIEMPRE que pertenece al usuario."""
    ronda = db.scalars(
        select(Round)
        .where(Round.id == ronda_id, Round.user_id == user_id)
        .options(
            selectinload(Round.holes),
            selectinload(Round.course),
            selectinload(Round.tournament),
        )
    ).first()
    if ronda is None:
        raise RONDA_NO_ENCONTRADA
    return ronda


def _validar_torneo(db: SesionBD, tournament_id: int | None, user_id: int) -> int | None:
    if tournament_id is None:
        return None
    torneo = db.scalars(
        select(Tournament).where(Tournament.id == tournament_id, Tournament.user_id == user_id)
    ).first()
    if torneo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El torneo indicado no existe o no es tuyo.",
        )
    return torneo.id


@router.post("", response_model=RondaGuardadaRespuesta, status_code=status.HTTP_201_CREATED)
def crear_ronda(datos: CrearRonda, usuario: UsuarioActual, db: SesionBD) -> RondaGuardadaRespuesta:
    campo = obtener_o_crear_campo(db, datos.course)
    tournament_id = _validar_torneo(db, datos.tournament_id, usuario.id)

    # Los totales se calculan aquí: nunca confiamos en lo que envíe el cliente.
    total_par = sum(h.par for h in datos.holes)
    total_strokes = sum(h.strokes for h in datos.holes)
    putts = [h.putts for h in datos.holes if h.putts is not None]
    total_putts = sum(putts) if len(putts) == len(datos.holes) else None

    ronda = Round(
        user_id=usuario.id,
        course_id=campo.id,
        tournament_id=tournament_id,
        played_on=datos.played_on or date.today(),
        holes_played=len(datos.holes),
        total_par=total_par,
        total_strokes=total_strokes,
        total_putts=total_putts,
        course_rating=datos.course_rating,
        slope_rating=datos.slope_rating,
        weather=datos.weather,
        notes=datos.notes,
        holes=[
            RoundHole(
                hole_number=h.hole_number,
                par=h.par,
                strokes=h.strokes,
                putts=h.putts,
                fairway_hit=h.fairway_hit,
                fairway_side=h.fairway_side,
                green_in_regulation=h.green_in_regulation,
                penalties=h.penalties,
            )
            for h in datos.holes
        ],
    )

    db.add(ronda)
    db.flush()

    handicap = recalcular_handicap(db, usuario)
    db.commit()
    db.refresh(ronda)

    return RondaGuardadaRespuesta(
        ronda=RondaDetalle.model_validate(ronda),
        handicap=handicap,
    )


@router.get("", response_model=PaginaRondas)
def listar_rondas(
    usuario: UsuarioActual,
    db: SesionBD,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    tournament_id: int | None = Query(default=None),
) -> PaginaRondas:
    filtros = [Round.user_id == usuario.id]
    if tournament_id is not None:
        filtros.append(Round.tournament_id == tournament_id)

    total = db.scalar(select(func.count(Round.id)).where(*filtros)) or 0

    rondas = db.scalars(
        select(Round)
        .where(*filtros)
        .options(selectinload(Round.course), selectinload(Round.tournament))
        .order_by(Round.played_on.desc(), Round.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return PaginaRondas(
        total=total,
        limit=limit,
        offset=offset,
        items=[RondaResumen.model_validate(r) for r in rondas],
    )


@router.get("/ultima", response_model=RondaDetalle | None)
def ultima_ronda(usuario: UsuarioActual, db: SesionBD) -> RondaDetalle | None:
    """Última ronda con su tarjeta completa (alimenta la gráfica del panel)."""
    ronda = db.scalars(
        select(Round)
        .where(Round.user_id == usuario.id)
        .options(
            selectinload(Round.holes), selectinload(Round.course), selectinload(Round.tournament)
        )
        .order_by(Round.played_on.desc(), Round.id.desc())
        .limit(1)
    ).first()

    return RondaDetalle.model_validate(ronda) if ronda else None


@router.get("/{ronda_id}", response_model=RondaDetalle)
def detalle_ronda(ronda_id: int, usuario: UsuarioActual, db: SesionBD) -> Round:
    return _cargar_ronda(db, ronda_id, usuario.id)


@router.patch("/{ronda_id}", response_model=RondaDetalle)
def actualizar_ronda(
    ronda_id: int, datos: ActualizarRonda, usuario: UsuarioActual, db: SesionBD
) -> Round:
    ronda = _cargar_ronda(db, ronda_id, usuario.id)

    if datos.quitar_torneo:
        ronda.tournament_id = None
    elif datos.tournament_id is not None:
        ronda.tournament_id = _validar_torneo(db, datos.tournament_id, usuario.id)

    if datos.played_on is not None:
        ronda.played_on = datos.played_on
    if datos.weather is not None:
        ronda.weather = datos.weather or None
    if datos.notes is not None:
        ronda.notes = datos.notes or None

    db.add(ronda)
    # La fecha influye en qué 20 rondas entran en el hándicap.
    recalcular_handicap(db, usuario)
    db.commit()
    db.refresh(ronda)
    return ronda


@router.delete("/{ronda_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_ronda(ronda_id: int, usuario: UsuarioActual, db: SesionBD) -> None:
    ronda = _cargar_ronda(db, ronda_id, usuario.id)
    db.delete(ronda)
    db.flush()
    recalcular_handicap(db, usuario)
    db.commit()
