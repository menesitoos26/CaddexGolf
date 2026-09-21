"""Esquemas Pydantic: contrato de entrada/salida de la API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# ---------------------------------------------------------------- tipos comunes

Nombre = Annotated[str, Field(min_length=2, max_length=100)]
# 72 bytes es el límite real de bcrypt; con 64 caracteres nunca lo superamos.
Password = Annotated[str, Field(min_length=8, max_length=64)]


class ModeloBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------- usuarios


class RegistroUsuario(BaseModel):
    name: Nombre
    email: EmailStr
    password: Password

    @field_validator("name")
    @classmethod
    def _limpiar_nombre(cls, valor: str) -> str:
        limpio = " ".join(valor.split())
        if len(limpio) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres.")
        return limpio


class LoginUsuario(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=64)


class ActualizarUsuario(BaseModel):
    name: Nombre | None = None
    email: EmailStr | None = None
    password: Password | None = None
    current_password: str | None = Field(
        default=None,
        max_length=64,
        description="Obligatoria para cambiar el correo o la contraseña.",
    )


class UsuarioPublico(ModeloBase):
    id: int
    name: str
    email: EmailStr
    handicap: float | None = None
    created_at: datetime | None = None


class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioPublico


# -------------------------------------------------------------------- campos


class CampoBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)


class CampoPublico(ModeloBase):
    id: int
    name: str
    city: str | None = None
    country: str | None = None


# -------------------------------------------------------------------- torneos


class TorneoBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    location: str | None = Field(default=None, max_length=150)
    start_date: date
    end_date: date | None = None
    final_position: int | None = Field(default=None, ge=1, le=9999)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _validar_fechas(self) -> TorneoBase:
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")
        return self


class CrearTorneo(TorneoBase):
    pass


class ActualizarTorneo(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    location: str | None = Field(default=None, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    final_position: int | None = Field(default=None, ge=1, le=9999)
    notes: str | None = Field(default=None, max_length=2000)


class TorneoPublico(ModeloBase):
    id: int
    name: str
    location: str | None = None
    start_date: date
    end_date: date | None = None
    final_position: int | None = None
    notes: str | None = None
    # Resumen agregado de las rondas asociadas.
    rondas_jugadas: int = 0
    total_golpes: int | None = None
    total_par: int | None = None
    diferencia_par: int | None = None


# --------------------------------------------------------------------- rondas


LadoCalle = Literal["izquierda", "centro", "derecha"]


class HoyoEntrada(BaseModel):
    hole_number: int = Field(ge=1, le=18)
    par: int = Field(ge=3, le=6)
    strokes: int = Field(ge=1, le=20)
    putts: int | None = Field(default=None, ge=0, le=15)
    fairway_hit: bool | None = None
    fairway_side: LadoCalle | None = None
    green_in_regulation: bool | None = None
    penalties: int = Field(default=0, ge=0, le=10)

    @model_validator(mode="after")
    def _validar_coherencia(self) -> HoyoEntrada:
        if self.putts is not None and self.putts > self.strokes:
            raise ValueError(
                f"Hoyo {self.hole_number}: los putts no pueden superar a los golpes."
            )

        # "centro" y "dio calle" son la misma cosa: mantenemos los dos campos
        # coherentes para que las estadísticas no se contradigan.
        if self.fairway_side is not None:
            object.__setattr__(self, "fairway_hit", self.fairway_side == "centro")
        elif self.fairway_hit:
            object.__setattr__(self, "fairway_side", "centro")

        return self


class HoyoPublico(ModeloBase):
    hole_number: int
    par: int
    strokes: int
    putts: int | None = None
    fairway_hit: bool | None = None
    fairway_side: LadoCalle | None = None
    green_in_regulation: bool | None = None
    penalties: int = 0


class CrearRonda(BaseModel):
    course: CampoBase
    played_on: date | None = None
    tournament_id: int | None = None
    course_rating: float | None = Field(default=None, ge=50, le=85)
    slope_rating: int | None = Field(default=None, ge=55, le=155)
    weather: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)
    holes: list[HoyoEntrada] = Field(min_length=1, max_length=18)

    @field_validator("played_on")
    @classmethod
    def _sin_futuro(cls, valor: date | None) -> date | None:
        if valor and valor > date.today():
            raise ValueError("No puedes registrar una ronda con fecha futura.")
        return valor

    @field_validator("holes")
    @classmethod
    def _hoyos_sin_repetir(cls, hoyos: list[HoyoEntrada]) -> list[HoyoEntrada]:
        numeros = [h.hole_number for h in hoyos]
        if len(set(numeros)) != len(numeros):
            raise ValueError("Hay números de hoyo repetidos en la tarjeta.")
        return sorted(hoyos, key=lambda h: h.hole_number)


class ActualizarRonda(BaseModel):
    """Permite reasignar/editar los metadatos de una ronda ya guardada."""

    played_on: date | None = None
    tournament_id: int | None = None
    weather: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)
    # Sentinela para poder desasignar el torneo explícitamente.
    quitar_torneo: bool = False

    @field_validator("played_on")
    @classmethod
    def _sin_futuro(cls, valor: date | None) -> date | None:
        if valor and valor > date.today():
            raise ValueError("No puedes registrar una ronda con fecha futura.")
        return valor


class RondaResumen(ModeloBase):
    id: int
    played_on: date
    holes_played: int
    total_par: int
    total_strokes: int
    total_putts: int | None = None
    diferencia_par: int
    course: CampoPublico
    tournament: TorneoResumen | None = None
    weather: str | None = None
    notes: str | None = None


class TorneoResumen(ModeloBase):
    id: int
    name: str


class RondaDetalle(RondaResumen):
    course_rating: float | None = None
    slope_rating: int | None = None
    holes: list[HoyoPublico] = []


class RondaGuardadaRespuesta(BaseModel):
    ronda: RondaDetalle
    handicap: float | None = None
    mensaje: str = "Ronda guardada correctamente."


class PaginaRondas(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[RondaResumen]


# ---------------------------------------------------------------- estadísticas


class RepartoResultados(BaseModel):
    """Cuántos hoyos ha hecho en cada categoría respecto al par."""

    eagles: int = 0
    birdies: int = 0
    pares: int = 0
    bogeys: int = 0
    dobles: int = 0
    triples_o_mas: int = 0
    total_hoyos: int = 0


class MediaPorPar(BaseModel):
    par: int
    hoyos_jugados: int
    media_golpes: float
    media_sobre_par: float


class PuntoEvolucion(BaseModel):
    round_id: int
    played_on: date
    campo: str
    holes_played: int
    diferencia_par: int
    # Diferencia normalizada a 18 hoyos, para poder comparar rondas de 9 y 18.
    diferencia_par_18: float


class RendimientoCampo(BaseModel):
    campo: str
    rondas: int
    media_sobre_par: float
    mejor_sobre_par: int


class DispersionCalle(BaseModel):
    """Hacia dónde se van las salidas cuando no van a calle."""

    izquierda: int = 0
    centro: int = 0
    derecha: int = 0
    total: int = 0


class ResumenEstadisticas(BaseModel):
    total_rondas: int = 0
    total_hoyos: int = 0
    handicap: float | None = None
    media_golpes_18: float | None = None
    media_sobre_par_18: float | None = None
    mejor_ronda_sobre_par: int | None = None
    peor_ronda_sobre_par: int | None = None
    media_putts_18: float | None = None
    porcentaje_calles: float | None = None
    porcentaje_greenes: float | None = None
    total_torneos: int = 0
    rondas_en_torneo: int = 0


class EstadisticasRespuesta(BaseModel):
    resumen: ResumenEstadisticas
    reparto: RepartoResultados
    dispersion_calle: DispersionCalle = DispersionCalle()
    por_par: list[MediaPorPar] = []
    evolucion: list[PuntoEvolucion] = []
    por_campo: list[RendimientoCampo] = []


# Necesario porque RondaResumen referencia a TorneoResumen antes de declararlo.
RondaResumen.model_rebuild()
RondaDetalle.model_rebuild()
