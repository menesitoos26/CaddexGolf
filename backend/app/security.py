"""Hasheo de contraseñas y emisión/verificación de tokens JWT."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import settings

# bcrypt sólo procesa los primeros 72 bytes; a partir de la versión 4 lanza
# ValueError si se le pasa algo más largo, así que lo controlamos nosotros.
LONGITUD_MAXIMA_PASSWORD_BYTES = 72


def password_demasiado_largo(password: str) -> bool:
    return len(password.encode("utf-8")) > LONGITUD_MAXIMA_PASSWORD_BYTES


def hashear_password(password: str) -> str:
    if password_demasiado_largo(password):
        raise ValueError("La contraseña supera el límite de 72 bytes.")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    """Comprueba la contraseña sin dejar que un hash corrupto tire la API."""
    if password_demasiado_largo(password):
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def crear_access_token(
    user_id: int,
    token_version: int = 0,
    expira_en: timedelta | None = None,
) -> str:
    """Emite un token para una generación concreta de sesiones del usuario."""
    ahora = datetime.now(UTC)
    expiracion = ahora + (expira_en or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "iat": int(ahora.timestamp()),
        "exp": int(expiracion.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decodificar_access_token(token: str) -> tuple[int, int] | None:
    """Devuelve (id de usuario, versión de sesión), o None si el token no vale.

    Los tokens emitidos antes de que existiera el versionado no llevan `ver`.
    Se les asigna la versión 0, que es la de cualquier cuenta que no haya
    cambiado su contraseña: así nadie se queda fuera al desplegar esto.
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub), int(payload.get("ver", 0))
    except (jwt.InvalidTokenError, ValueError, TypeError):
        return None


# --------------------------------------------- tokens de restablecimiento

# 32 bytes de entropía: imposible de adivinar por fuerza bruta, y sigue cabiendo
# en una URL sin que el correo la parta en dos líneas.
BYTES_TOKEN_RESTABLECIMIENTO = 32


def generar_token_restablecimiento() -> tuple[str, str]:
    """Devuelve (token en claro, hash para guardar).

    El token en claro sólo viaja al correo del usuario; en la base de datos se
    guarda únicamente el hash.
    """
    token = secrets.token_urlsafe(BYTES_TOKEN_RESTABLECIMIENTO)
    return token, hashear_token_restablecimiento(token)


def hashear_token_restablecimiento(token: str) -> str:
    """SHA-256 basta aquí: el token ya es aleatorio y de alta entropía.

    No se usa bcrypt a propósito. bcrypt es lento por diseño para proteger
    contraseñas humanas, que son adivinables; un token de 32 bytes aleatorios
    no lo es, así que el coste sólo serviría para ralentizar la validación.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
