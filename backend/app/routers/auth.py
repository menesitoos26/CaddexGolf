"""Registro, inicio de sesión y gestión del perfil."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select, update

from app.config import settings
from app.correo import enviar_restablecimiento
from app.deps import SesionBD, UsuarioActual
from app.models import PasswordReset, User
from app.schemas import (
    ActualizarUsuario,
    ConfirmarRestablecimiento,
    LoginUsuario,
    MensajeRespuesta,
    PerfilActualizado,
    RegistroUsuario,
    SolicitarRestablecimiento,
    TokenRespuesta,
    UsuarioPublico,
)
from app.security import (
    crear_access_token,
    generar_token_restablecimiento,
    hashear_password,
    hashear_token_restablecimiento,
    verificar_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Mensaje genérico a propósito: no revelamos si el correo existe o no.
CREDENCIALES_ERRONEAS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Correo o contraseña incorrectos.",
)


def _normalizar_email(email: str) -> str:
    return email.strip().lower()


def _invalidar_sesiones(usuario: User) -> None:
    """Deja sin valor todos los tokens emitidos hasta ahora para este usuario.

    Se llama en cada cambio de contraseña. Es lo que convierte un cambio de
    contraseña en algo que sirve de verdad: sin esto, quien tuviera un token
    robado seguiría dentro hasta una semana después.
    """
    usuario.token_version += 1


@router.post("/registro", response_model=TokenRespuesta, status_code=status.HTTP_201_CREATED)
def registrar(datos: RegistroUsuario, db: SesionBD) -> TokenRespuesta:
    email = _normalizar_email(datos.email)

    if db.scalars(select(User).where(User.email == email)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese correo electrónico.",
        )

    usuario = User(
        name=datos.name,
        email=email,
        password_hash=hashear_password(datos.password),
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    return TokenRespuesta(
        access_token=crear_access_token(usuario.id, usuario.token_version),
        user=UsuarioPublico.model_validate(usuario),
    )


@router.post("/login", response_model=TokenRespuesta)
def login(datos: LoginUsuario, db: SesionBD) -> TokenRespuesta:
    usuario = db.scalars(
        select(User).where(User.email == _normalizar_email(datos.email))
    ).first()

    if usuario is None or not verificar_password(datos.password, usuario.password_hash):
        raise CREDENCIALES_ERRONEAS

    return TokenRespuesta(
        access_token=crear_access_token(usuario.id, usuario.token_version),
        user=UsuarioPublico.model_validate(usuario),
    )


@router.get("/me", response_model=UsuarioPublico)
def perfil(usuario: UsuarioActual) -> User:
    return usuario


@router.put("/me", response_model=PerfilActualizado)
def actualizar_perfil(
    datos: ActualizarUsuario, usuario: UsuarioActual, db: SesionBD
) -> PerfilActualizado:
    cambia_email = datos.email is not None and _normalizar_email(datos.email) != usuario.email
    cambia_password = bool(datos.password)

    # Cambiar credenciales exige confirmar la contraseña actual.
    if (cambia_email or cambia_password) and (
        not datos.current_password
        or not verificar_password(datos.current_password, usuario.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes indicar tu contraseña actual para cambiar el correo o la contraseña.",
        )

    if cambia_email:
        email = _normalizar_email(datos.email)  # type: ignore[arg-type]
        ocupado = db.scalars(
            select(User).where(User.email == email, User.id != usuario.id)
        ).first()
        if ocupado:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese correo ya está registrado por otra persona.",
            )
        usuario.email = email

    if datos.name:
        usuario.name = datos.name

    if cambia_password:
        usuario.password_hash = hashear_password(datos.password)  # type: ignore[arg-type]
        _invalidar_sesiones(usuario)

    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    # Si se cambió la contraseña, las sesiones anteriores han quedado anuladas.
    # Devolvemos un token nuevo para que este dispositivo siga dentro: lo
    # contrario sería echar al usuario justo después de hacer lo correcto.
    token_nuevo = (
        crear_access_token(usuario.id, usuario.token_version) if cambia_password else None
    )

    return PerfilActualizado(
        **UsuarioPublico.model_validate(usuario).model_dump(),
        access_token=token_nuevo,
    )


# ------------------------------------------ restablecimiento de contraseña


@router.post(
    "/recuperar",
    response_model=MensajeRespuesta,
    status_code=status.HTTP_202_ACCEPTED,
)
def solicitar_restablecimiento(
    datos: SolicitarRestablecimiento, db: SesionBD, tareas: BackgroundTasks
) -> MensajeRespuesta:
    """Envía un enlace para elegir una contraseña nueva.

    Responde siempre lo mismo exista o no la cuenta. Si contestáramos distinto,
    esto se convertiría en una herramienta para averiguar qué correos están
    registrados, que es justo lo que el login ya evita.
    """
    respuesta = MensajeRespuesta(
        mensaje=(
            "Si ese correo tiene una cuenta, te hemos enviado un enlace para "
            "restablecer la contraseña. Revisa también la carpeta de spam."
        )
    )

    email = _normalizar_email(datos.email)
    usuario = db.scalars(select(User).where(User.email == email)).first()
    if usuario is None:
        return respuesta

    # Las peticiones anteriores que sigan vivas se anulan: pedir un enlace
    # nuevo debe dejar inservible el viejo.
    db.execute(
        update(PasswordReset)
        .where(PasswordReset.user_id == usuario.id, PasswordReset.usado_en.is_(None))
        .values(usado_en=datetime.now(UTC).replace(tzinfo=None))
    )

    token, token_hash = generar_token_restablecimiento()
    db.add(
        PasswordReset(
            user_id=usuario.id,
            token_hash=token_hash,
            expira_en=(
                datetime.now(UTC) + timedelta(minutes=settings.reset_token_expire_minutes)
            ).replace(tzinfo=None),
        )
    )
    db.commit()

    enlace = f"{settings.app_base_url.rstrip('/')}/restablecer?token={quote(token)}"

    # En segundo plano: el SMTP puede tardar segundos y quien espera no tiene
    # por qué notarlo, sobre todo desde un móvil con mala cobertura.
    tareas.add_task(enviar_restablecimiento, usuario.email, usuario.name, enlace)

    return respuesta


@router.post("/restablecer", response_model=MensajeRespuesta)
def confirmar_restablecimiento(
    datos: ConfirmarRestablecimiento, db: SesionBD
) -> MensajeRespuesta:
    """Fija la contraseña nueva a partir del token recibido por correo."""
    ahora = datetime.now(UTC).replace(tzinfo=None)

    peticion = db.scalars(
        select(PasswordReset).where(
            PasswordReset.token_hash == hashear_token_restablecimiento(datos.token)
        )
    ).first()

    # Mismo error para token inexistente, caducado o ya usado: no damos pistas
    # sobre cuál de las tres cosas ha pasado.
    if peticion is None or peticion.usado_en is not None or peticion.expira_en < ahora:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace no es válido o ha caducado. Pide uno nuevo.",
        )

    usuario = db.get(User, peticion.user_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace no es válido o ha caducado. Pide uno nuevo.",
        )

    usuario.password_hash = hashear_password(datos.password)
    _invalidar_sesiones(usuario)
    peticion.usado_en = ahora

    # Cualquier otra petición pendiente de este usuario deja de valer.
    db.execute(
        update(PasswordReset)
        .where(
            PasswordReset.user_id == usuario.id,
            PasswordReset.usado_en.is_(None),
        )
        .values(usado_en=ahora)
    )

    db.add(usuario)
    db.commit()

    logger.info("Contraseña restablecida para el usuario %s", usuario.id)

    return MensajeRespuesta(
        mensaje="Contraseña actualizada. Ya puedes entrar con la nueva."
    )
