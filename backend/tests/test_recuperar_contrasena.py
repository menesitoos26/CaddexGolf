"""Tests del restablecimiento de contraseña.

Lo que más se comprueba aquí no es el camino feliz, sino que el flujo no se
pueda usar para nada distinto de lo que debe: averiguar qué correos existen,
reutilizar un enlace, o mantener viva una sesión que debería haber muerto.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import PasswordReset, User


@pytest.fixture
def capturar_correos(monkeypatch):
    """Intercepta el envío para poder leer el enlace sin servidor SMTP."""
    enviados = []

    def falso_envio(destinatario, nombre, enlace):
        enviados.append({"destinatario": destinatario, "nombre": nombre, "enlace": enlace})
        return True

    monkeypatch.setattr("app.routers.auth.enviar_restablecimiento", falso_envio)
    return enviados


def token_del_enlace(enlace: str) -> str:
    return enlace.split("token=", 1)[1]


def pedir_restablecimiento(client, email: str):
    return client.post("/auth/recuperar", json={"email": email})


# ------------------------------------------------------- no filtrar cuentas


def test_responde_igual_exista_o_no_la_cuenta(client, usuario_registrado, capturar_correos):
    existente = pedir_restablecimiento(client, "ana@example.com")
    inexistente = pedir_restablecimiento(client, "nadie@example.com")

    assert existente.status_code == inexistente.status_code == 202
    assert existente.json() == inexistente.json()


def test_solo_se_envia_correo_si_la_cuenta_existe(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "nadie@example.com")
    assert capturar_correos == []

    pedir_restablecimiento(client, "ana@example.com")
    assert len(capturar_correos) == 1
    assert capturar_correos[0]["destinatario"] == "ana@example.com"


def test_el_email_se_normaliza(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "  ANA@Example.COM  ")
    assert len(capturar_correos) == 1


# ------------------------------------------------------------ camino feliz


def test_restablecer_permite_entrar_con_la_nueva(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])

    respuesta = client.post(
        "/auth/restablecer", json={"token": token, "password": "ContrasenaNueva123"}
    )
    assert respuesta.status_code == 200, respuesta.text

    nueva = client.post(
        "/auth/login", json={"email": "ana@example.com", "password": "ContrasenaNueva123"}
    )
    assert nueva.status_code == 200

    vieja = client.post(
        "/auth/login", json={"email": "ana@example.com", "password": "Password123"}
    )
    assert vieja.status_code == 401


# ----------------------------------------------------- el token no se guarda


def test_el_token_no_se_guarda_en_claro(client, db_session, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])

    peticion = db_session.scalars(select(PasswordReset)).first()
    assert peticion is not None
    assert peticion.token_hash != token
    assert len(peticion.token_hash) == 64  # sha256 en hexadecimal


# ------------------------------------------------------ enlaces inservibles


def test_un_token_solo_sirve_una_vez(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])

    primera = client.post("/auth/restablecer", json={"token": token, "password": "Primera123"})
    assert primera.status_code == 200

    segunda = client.post("/auth/restablecer", json={"token": token, "password": "Segunda123"})
    assert segunda.status_code == 400


def test_pedir_otro_enlace_anula_el_anterior(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    primer_token = token_del_enlace(capturar_correos[0]["enlace"])

    pedir_restablecimiento(client, "ana@example.com")
    segundo_token = token_del_enlace(capturar_correos[1]["enlace"])
    assert primer_token != segundo_token

    viejo = client.post(
        "/auth/restablecer", json={"token": primer_token, "password": "ConElViejo123"}
    )
    assert viejo.status_code == 400

    nuevo = client.post(
        "/auth/restablecer", json={"token": segundo_token, "password": "ConElNuevo123"}
    )
    assert nuevo.status_code == 200


def test_un_token_caducado_no_vale(client, db_session, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])

    peticion = db_session.scalars(select(PasswordReset)).first()
    peticion.expira_en = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
    db_session.commit()

    respuesta = client.post(
        "/auth/restablecer", json={"token": token, "password": "Caducada123"}
    )
    assert respuesta.status_code == 400


def test_un_token_inventado_no_vale(client, usuario_registrado):
    respuesta = client.post(
        "/auth/restablecer",
        json={"token": "a" * 43, "password": "Inventada123"},
    )
    assert respuesta.status_code == 400


def test_el_mensaje_de_error_no_distingue_el_motivo(client, usuario_registrado, capturar_correos):
    """Token inexistente y token usado deben responder exactamente lo mismo."""
    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])
    client.post("/auth/restablecer", json={"token": token, "password": "Usada12345"})

    usado = client.post("/auth/restablecer", json={"token": token, "password": "Otra123456"})
    inventado = client.post(
        "/auth/restablecer", json={"token": "z" * 43, "password": "Otra123456"}
    )

    assert usado.status_code == inventado.status_code == 400
    assert usado.json() == inventado.json()


def test_rechaza_una_contrasena_demasiado_corta(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])

    respuesta = client.post("/auth/restablecer", json={"token": token, "password": "corta"})
    assert respuesta.status_code == 422


# --------------------------------------------------- invalidación de sesiones


def test_restablecer_expulsa_las_sesiones_anteriores(
    client, usuario_registrado, capturar_correos
):
    """El escenario real: alguien te ha robado el token y cambias la contraseña."""
    cabeceras_del_intruso = usuario_registrado["headers"]
    assert client.get("/auth/me", headers=cabeceras_del_intruso).status_code == 200

    pedir_restablecimiento(client, "ana@example.com")
    token = token_del_enlace(capturar_correos[0]["enlace"])
    client.post("/auth/restablecer", json={"token": token, "password": "YaNoEntras123"})

    assert client.get("/auth/me", headers=cabeceras_del_intruso).status_code == 401


def test_cambiar_la_contrasena_en_el_perfil_tambien_expulsa(client, usuario_registrado):
    cabeceras_viejas = usuario_registrado["headers"]

    respuesta = client.put(
        "/auth/me",
        json={"password": "PerfilNueva123", "current_password": "Password123"},
        headers=cabeceras_viejas,
    )
    assert respuesta.status_code == 200

    # El dispositivo que hizo el cambio recibe un token nuevo y sigue dentro...
    token_nuevo = respuesta.json()["access_token"]
    assert token_nuevo
    cabeceras_nuevas = {"Authorization": f"Bearer {token_nuevo}"}
    assert client.get("/auth/me", headers=cabeceras_nuevas).status_code == 200

    # ...pero el token anterior ya no sirve.
    assert client.get("/auth/me", headers=cabeceras_viejas).status_code == 401


def test_editar_el_nombre_no_expulsa_a_nadie(client, usuario_registrado):
    respuesta = client.put(
        "/auth/me", json={"name": "Ana Golfista Madrid"}, headers=usuario_registrado["headers"]
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["access_token"] is None
    assert client.get("/auth/me", headers=usuario_registrado["headers"]).status_code == 200


def test_el_enlace_apunta_a_la_pagina_de_restablecer(client, usuario_registrado, capturar_correos):
    pedir_restablecimiento(client, "ana@example.com")
    enlace = capturar_correos[0]["enlace"]
    assert "/restablecer?token=" in enlace


def test_borrar_el_usuario_arrastra_sus_peticiones(
    client, db_session, usuario_registrado, capturar_correos
):
    pedir_restablecimiento(client, "ana@example.com")
    assert db_session.scalars(select(PasswordReset)).first() is not None

    usuario = db_session.get(User, usuario_registrado["user"]["id"])
    db_session.delete(usuario)
    db_session.commit()

    assert db_session.scalars(select(PasswordReset)).first() is None
