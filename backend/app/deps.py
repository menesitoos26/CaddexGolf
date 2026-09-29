"""Dependencias compartidas de FastAPI (autenticación)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decodificar_access_token

esquema_bearer = HTTPBearer(auto_error=False, description="Token JWT obtenido en /auth/login")

CREDENCIALES_INVALIDAS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No autenticado o sesión caducada.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(esquema_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credenciales is None or not credenciales.credentials:
        raise CREDENCIALES_INVALIDAS

    descifrado = decodificar_access_token(credenciales.credentials)
    if descifrado is None:
        raise CREDENCIALES_INVALIDAS

    user_id, version = descifrado

    usuario = db.get(User, user_id)
    if usuario is None:
        raise CREDENCIALES_INVALIDAS

    # Un token de una generación anterior ya no vale. Es lo que hace que
    # restablecer la contraseña expulse de verdad a quien se hubiera colado en
    # la cuenta, en vez de dejarle el token vivo hasta siete días.
    if version != usuario.token_version:
        raise CREDENCIALES_INVALIDAS

    return usuario


UsuarioActual = Annotated[User, Depends(get_current_user)]
SesionBD = Annotated[Session, Depends(get_db)]
