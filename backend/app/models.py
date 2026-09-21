"""Modelos ORM de Golf Tracker.

Decisión de diseño: la tarjeta de una ronda (par y golpes de cada hoyo) se
guarda dentro de la propia ronda (`round_holes`) y no colgando del campo.
Motivo: el jugador introduce el par a mano y puede jugar 9 o 18 hoyos en el
mismo club, así que el par "del campo" no es un dato fiable ni estable. El
campo (`courses`) queda como un simple directorio de clubes.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    handicap: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    rounds: Mapped[list[Round]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    tournaments: Mapped[list[Tournament]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    rounds: Mapped[list[Round]] = relationship(back_populates="course")

    __table_args__ = (
        # Un mismo club en la misma ciudad no debe duplicarse.
        UniqueConstraint("name", "city", name="uq_course_name_city"),
    )


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Posición final del jugador en el torneo (opcional, la rellena él).
    final_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="tournaments")
    rounds: Mapped[list[Round]] = relationship(back_populates="tournament")


class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    tournament_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournaments.id", ondelete="SET NULL"), nullable=True, index=True
    )

    played_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    holes_played: Mapped[int] = mapped_column(Integer, nullable=False)

    # Totales calculados en el backend a partir de la tarjeta (nunca del cliente).
    total_par: Mapped[int] = mapped_column(Integer, nullable=False)
    total_strokes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_putts: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Datos de valoración del campo. Si no se conocen usamos los neutros
    # (rating = par, slope = 113), con lo que el diferencial es golpes - par.
    course_rating: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    slope_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    weather: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="rounds")
    course: Mapped[Course] = relationship(back_populates="rounds")
    tournament: Mapped[Tournament | None] = relationship(back_populates="rounds")
    holes: Mapped[list[RoundHole]] = relationship(
        back_populates="round",
        cascade="all, delete-orphan",
        order_by="RoundHole.hole_number",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("holes_played > 0", name="ck_round_holes_played"),
        Index("ix_rounds_user_played_on", "user_id", "played_on"),
    )

    @property
    def diferencia_par(self) -> int:
        """Golpes por encima (+) o por debajo (-) del par de lo jugado."""
        return self.total_strokes - self.total_par


class RoundHole(Base):
    """Un hoyo concreto dentro de la tarjeta de una ronda."""

    __tablename__ = "round_holes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(
        ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hole_number: Mapped[int] = mapped_column(Integer, nullable=False)
    par: Mapped[int] = mapped_column(Integer, nullable=False)
    strokes: Mapped[int] = mapped_column(Integer, nullable=False)
    putts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fairway_hit: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Hacia dónde se falló la calle: 'izquierda' | 'centro' | 'derecha'.
    # Saber que siempre fallas al mismo lado es más útil que un simple sí/no.
    fairway_side: Mapped[str | None] = mapped_column(String(10), nullable=True)
    green_in_regulation: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    penalties: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    round: Mapped[Round] = relationship(back_populates="holes")

    __table_args__ = (
        UniqueConstraint("round_id", "hole_number", name="uq_round_hole"),
        CheckConstraint("par BETWEEN 3 AND 6", name="ck_hole_par"),
        CheckConstraint("strokes BETWEEN 1 AND 20", name="ck_hole_strokes"),
        CheckConstraint(
            "fairway_side IS NULL OR fairway_side IN ('izquierda', 'centro', 'derecha')",
            name="ck_hole_fairway_side",
        ),
    )
