"""Tests de la dispersión de calle (izquierda / centro / derecha)."""

from __future__ import annotations


def guardar(client, headers, hoyos):
    return client.post(
        "/rondas", json={"course": {"name": "Club Calle"}, "holes": hoyos}, headers=headers
    )


def test_centro_implica_calle_acertada(client, usuario_registrado):
    respuesta = guardar(
        client,
        usuario_registrado["headers"],
        [{"hole_number": 1, "par": 4, "strokes": 4, "fairway_side": "centro"}],
    )

    hoyo = respuesta.json()["ronda"]["holes"][0]
    assert hoyo["fairway_side"] == "centro"
    assert hoyo["fairway_hit"] is True


def test_fallar_a_un_lado_implica_calle_no_acertada(client, usuario_registrado):
    respuesta = guardar(
        client,
        usuario_registrado["headers"],
        [{"hole_number": 1, "par": 4, "strokes": 5, "fairway_side": "izquierda"}],
    )

    hoyo = respuesta.json()["ronda"]["holes"][0]
    assert hoyo["fairway_side"] == "izquierda"
    assert hoyo["fairway_hit"] is False


def test_el_lado_manda_sobre_un_fairway_hit_contradictorio(client, usuario_registrado):
    # Si el cliente envía datos incoherentes, gana el lado indicado.
    respuesta = guardar(
        client,
        usuario_registrado["headers"],
        [
            {
                "hole_number": 1,
                "par": 4,
                "strokes": 5,
                "fairway_hit": True,
                "fairway_side": "derecha",
            }
        ],
    )

    assert respuesta.json()["ronda"]["holes"][0]["fairway_hit"] is False


def test_calle_acertada_sin_lado_se_marca_como_centro(client, usuario_registrado):
    respuesta = guardar(
        client,
        usuario_registrado["headers"],
        [{"hole_number": 1, "par": 4, "strokes": 4, "fairway_hit": True}],
    )

    assert respuesta.json()["ronda"]["holes"][0]["fairway_side"] == "centro"


def test_rechaza_un_lado_inventado(client, usuario_registrado):
    respuesta = guardar(
        client,
        usuario_registrado["headers"],
        [{"hole_number": 1, "par": 4, "strokes": 4, "fairway_side": "arriba"}],
    )
    assert respuesta.status_code == 422


def test_estadistica_de_dispersion(client, usuario_registrado):
    headers = usuario_registrado["headers"]
    lados = ["izquierda", "izquierda", "centro", "derecha"]
    hoyos = [
        {"hole_number": i + 1, "par": 4, "strokes": 5, "fairway_side": lado}
        for i, lado in enumerate(lados)
    ]
    # Un par 3 con lado no debe contar: en par 3 no se juega la calle.
    hoyos.append({"hole_number": 5, "par": 3, "strokes": 3, "fairway_side": "izquierda"})

    guardar(client, headers, hoyos)

    datos = client.get("/estadisticas", headers=headers).json()

    assert datos["dispersion_calle"] == {
        "izquierda": 2,
        "centro": 1,
        "derecha": 1,
        "total": 4,
    }
    assert datos["resumen"]["porcentaje_calles"] == 25.0  # 1 de 4


def test_dispersion_vacia_si_no_se_registra_la_calle(client, usuario_registrado):
    headers = usuario_registrado["headers"]
    guardar(client, headers, [{"hole_number": 1, "par": 4, "strokes": 4}])

    datos = client.get("/estadisticas", headers=headers).json()
    assert datos["dispersion_calle"]["total"] == 0
