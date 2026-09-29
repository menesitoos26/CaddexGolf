"""Envío de correo.

Deliberadamente sencillo: `smtplib` de la biblioteca estándar, sin dependencias
ni servicios propietarios. Cualquier proveedor que hable SMTP —Gmail con
contraseña de aplicación, Brevo, Resend, un servidor propio— funciona cambiando
variables de entorno, sin tocar código.

Si no hay SMTP configurado, el mensaje se escribe en el log en vez de enviarse.
Así se puede desarrollar y probar el flujo completo sin cuenta de correo, y un
despliegue sin configurar no revienta: simplemente no manda nada, y queda
constancia en el log.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def enviar_correo(destinatario: str, asunto: str, cuerpo_texto: str, cuerpo_html: str) -> bool:
    """Envía un correo. Devuelve False si no se pudo (nunca lanza excepción).

    Un fallo de correo no debe convertirse en un error para quien está usando
    la aplicación: el endpoint que lo llama responde igual, y aquí queda el
    registro de lo que ha pasado.
    """
    if not settings.correo_configurado:
        logger.warning(
            "SMTP no configurado. Correo NO enviado a %s.\nAsunto: %s\n%s",
            destinatario,
            asunto,
            cuerpo_texto,
        )
        return False

    mensaje = EmailMessage()
    mensaje["From"] = settings.smtp_remitente
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo_texto)
    mensaje.add_alternative(cuerpo_html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as servidor:
            if settings.smtp_starttls:
                servidor.starttls()
            if settings.smtp_user:
                servidor.login(settings.smtp_user, settings.smtp_password)
            servidor.send_message(mensaje)
    except (smtplib.SMTPException, OSError) as error:
        logger.error("No se pudo enviar el correo a %s: %s", destinatario, error)
        return False

    logger.info("Correo enviado a %s: %s", destinatario, asunto)
    return True


def enviar_restablecimiento(destinatario: str, nombre: str, enlace: str) -> bool:
    """Correo con el enlace para elegir una contraseña nueva."""
    minutos = settings.reset_token_expire_minutes

    texto = f"""Hola {nombre}:

Has pedido restablecer tu contraseña de Caddex Golf.

Abre este enlace para elegir una nueva:
{enlace}

El enlace caduca en {minutos} minutos y sólo se puede usar una vez.

Si no has sido tú, puedes ignorar este mensaje: tu contraseña no ha cambiado.

— Caddex Golf
"""

    html = f"""<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f2e9;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
               color:#14161c;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;
                padding:32px;border:1px solid #ddd8c7;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.14em;
                text-transform:uppercase;color:#6b6f63;">Caddex Golf</p>
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;">Restablece tu contraseña</h1>

      <p style="margin:0 0 16px;line-height:1.6;">Hola {nombre}:</p>
      <p style="margin:0 0 24px;line-height:1.6;">
        Has pedido restablecer tu contraseña. Pulsa el botón para elegir una nueva.
      </p>

      <p style="margin:0 0 24px;">
        <a href="{enlace}"
           style="display:inline-block;background:#14161c;color:#c4f23c;
                  text-decoration:none;font-weight:600;padding:14px 26px;
                  border-radius:10px;">Elegir contraseña nueva</a>
      </p>

      <p style="margin:0 0 24px;line-height:1.6;font-size:14px;color:#6b6f63;">
        El enlace caduca en {minutos} minutos y sólo se puede usar una vez.
        Si el botón no funciona, copia esta dirección en el navegador:<br>
        <span style="word-break:break-all;color:#14161c;">{enlace}</span>
      </p>

      <hr style="border:none;border-top:1px solid #ddd8c7;margin:0 0 20px;">
      <p style="margin:0;line-height:1.6;font-size:13px;color:#6b6f63;">
        Si no has sido tú, ignora este mensaje: tu contraseña no ha cambiado.
      </p>
    </div>
  </body>
</html>"""

    return enviar_correo(destinatario, "Restablece tu contraseña de Caddex Golf", texto, html)
