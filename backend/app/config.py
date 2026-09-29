"""Configuración de la aplicación.

Todos los valores se leen de variables de entorno (o del fichero .env) para que
el mismo código funcione en local, en Docker y en producción sin tocar nada.
"""

from __future__ import annotations

import secrets
import warnings
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Golf Tracker API"
    app_version: str = "1.0.0"
    environment: str = "development"

    # Por defecto SQLite para poder arrancar en local sin Docker ni MySQL.
    # En Docker se sobreescribe con la URL de MySQL desde el .env.
    database_url: str = "sqlite:///./golf_tracker.db"

    # Seguridad
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 días

    # CORS: lista separada por comas. En producción hay que ser explícito.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Dirección pública de la aplicación, para construir el enlace que se envía
    # por correo al restablecer la contraseña.
    app_base_url: str = "http://localhost:5173"

    # Restablecimiento de contraseña. Una hora es suficiente para abrir el
    # correo y bastante poco para que un enlace olvidado en la bandeja de
    # entrada siga siendo útil a quien no debe.
    reset_token_expire_minutes: int = 60

    # SMTP. Si no hay servidor configurado, el enlace se escribe en el log en
    # lugar de enviarse: así se puede desarrollar sin cuenta de correo.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    smtp_remitente: str = "Caddex Golf <no-responder@caddexgolf.com>"

    # API externa de campos de golf (se consume desde el backend, nunca desde
    # el navegador, para no exponer la clave).
    golf_course_api_key: str = ""
    golf_course_api_url: str = "https://api.golfcourseapi.com/v1"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def correo_configurado(self) -> bool:
        return bool(self.smtp_host)

    @field_validator("database_url")
    @classmethod
    def _normalizar_url_bd(cls, valor: str) -> str:
        """Acepta URLs genéricas y las traduce al driver que tenemos instalado."""
        if valor.startswith("mysql://"):
            return valor.replace("mysql://", "mysql+pymysql://", 1)
        return valor

    @model_validator(mode="after")
    def _validar_secreto(self) -> Settings:
        # HS256 usa HMAC-SHA256: por debajo de 32 bytes la clave es más débil
        # que el propio algoritmo (RFC 7518 §3.2).
        if self.jwt_secret_key and len(self.jwt_secret_key.encode()) < 32:
            raise ValueError("JWT_SECRET_KEY debe tener al menos 32 caracteres.")

        if not self.jwt_secret_key:
            if self.is_production:
                raise ValueError(
                    "JWT_SECRET_KEY es obligatoria en producción. "
                    "Genera una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
                )
            # En desarrollo generamos una efímera: al reiniciar caducan los tokens,
            # pero evitamos que nadie despliegue con un secreto por defecto conocido.
            object.__setattr__(self, "jwt_secret_key", secrets.token_urlsafe(48))
            warnings.warn(
                "JWT_SECRET_KEY no configurada: usando un secreto temporal de desarrollo.",
                stacklevel=2,
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
