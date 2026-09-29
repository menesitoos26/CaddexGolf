#!/usr/bin/env python3
"""Genera los iconos de la PWA a partir del símbolo de marca.

El símbolo (bandera con línea de progreso) vive en frontend/public/favicon.svg.
Este script produce los PNG que piden Android e iOS para instalar la aplicación,
para que no haya que mantenerlos a mano ni rehacerlos con un editor cuando
cambie la marca.

    pip install cairosvg
    python3 scripts/generar-iconos.py

Sobre el icono "maskable": Android recorta los iconos con la forma que tenga el
lanzador (círculo, cuadrado redondeado, gota...). Sólo garantiza que se vea el
80% central, así que ese icono lleva el símbolo reducido y el fondo a sangre.
Si se usara el icono normal, el recorte se comería la bandera.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cairosvg

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "frontend" / "public" / "iconos"

CARBON = "#14161C"
HUESO = "#F4F6F1"
VOLTIO = "#C4F23C"

# El símbolo, sin fondo, en una retícula de 32x32.
SIMBOLO = f"""
  <path d="M8 30V3" stroke="{HUESO}" stroke-width="2.2" stroke-linecap="square"/>
  <path d="M9.5 4h13l-4.5 4.5 4.5 4.5h-13z" fill="{VOLTIO}"/>
  <path d="M8 25l6-5 5 3 7-9" stroke="{VOLTIO}" stroke-width="2.2" stroke-linecap="square"/>
"""


def svg_normal() -> str:
    """Icono estándar: fondo con esquinas redondeadas, símbolo a tamaño completo."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="{CARBON}"/>
  {SIMBOLO}
</svg>"""


def svg_opaco() -> str:
    """Para iOS: sin esquinas redondeadas (las pone el sistema) y sin transparencia."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="{CARBON}"/>
  {SIMBOLO}
</svg>"""


def svg_maskable() -> str:
    """Fondo a sangre y símbolo al 60%, centrado dentro de la zona segura."""
    escala = 0.6
    desplazamiento = (32 - 32 * escala) / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="{CARBON}"/>
  <g transform="translate({desplazamiento},{desplazamiento}) scale({escala})">
    {SIMBOLO}
  </g>
</svg>"""


ICONOS = [
    ("icono-192.png", svg_normal, 192),
    ("icono-512.png", svg_normal, 512),
    ("icono-maskable-512.png", svg_maskable, 512),
    ("apple-touch-icon.png", svg_opaco, 180),
]


def main() -> int:
    DESTINO.mkdir(parents=True, exist_ok=True)

    for nombre, constructor, tamano in ICONOS:
        salida = DESTINO / nombre
        cairosvg.svg2png(
            bytestring=constructor().encode("utf-8"),
            write_to=str(salida),
            output_width=tamano,
            output_height=tamano,
        )
        print(f"  {salida.relative_to(RAIZ)}  ({tamano}x{tamano})")

    print(f"\n{len(ICONOS)} iconos generados en {DESTINO.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
