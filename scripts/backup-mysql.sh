#!/bin/bash
#
# Copia de seguridad de la base de datos de Caddex Golf.
#
# Hasta ahora los datos vivían únicamente en el volumen `mysql_data` de Docker.
# Eso significa que un `docker compose down -v` a destiempo, una migración mal
# aplicada o un problema con la instancia de Oracle se llevaban por delante
# todas las rondas de todos los jugadores, sin vuelta atrás.
#
# Este script vuelca la base de datos a un fichero comprimido, comprueba que el
# volcado sirve de verdad y va rotando los antiguos.
#
# Instalación (en el servidor, una sola vez):
#
#   chmod +x ~/CaddexGolf/scripts/backup-mysql.sh
#   crontab -e
#   # y añadir esta línea: copia diaria a las 04:15
#   15 4 * * * /home/ubuntu/CaddexGolf/scripts/backup-mysql.sh >> /home/ubuntu/backups/caddex/backup.log 2>&1
#
# IMPORTANTE: una copia que vive en el mismo servidor que la base de datos no
# es una copia de seguridad, es una copia. Protege de un borrado accidental,
# NO de perder la instancia. Ver la nota del final sobre sacarlas fuera.

set -Eeuo pipefail

# ----------------------------------------------------------------- parámetros

DIRECTORIO_BACKUPS="${DIRECTORIO_BACKUPS:-$HOME/backups/caddex}"
DIAS_DE_RETENCION="${DIAS_DE_RETENCION:-7}"
CONTENEDOR_BD="${CONTENEDOR_BD:-caddex_db}"

# El .env de docker es la fuente de las credenciales: así no se duplican aquí.
RAIZ_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FICHERO_ENV="${FICHERO_ENV:-$RAIZ_PROYECTO/docker/.env}"

marca_de_tiempo() { date +'%Y-%m-%d %H:%M:%S'; }
registrar() { echo "[$(marca_de_tiempo)] $*"; }
fallar() { registrar "ERROR: $*" >&2; exit 1; }

trap 'fallar "el script se ha interrumpido en la línea $LINENO"' ERR

# ------------------------------------------------------------- comprobaciones

registrar "=== Copia de seguridad de Caddex Golf ==="

[[ -f "$FICHERO_ENV" ]] || fallar "no encuentro $FICHERO_ENV"

# Leemos el .env sin volcarlo al entorno entero.
leer_variable() {
  local clave="$1"
  grep -E "^${clave}=" "$FICHERO_ENV" | tail -1 | cut -d= -f2- | tr -d '"'"'"''
}

BASE_DE_DATOS="$(leer_variable MYSQL_DATABASE)"
USUARIO="$(leer_variable MYSQL_USER)"
PASSWORD="$(leer_variable MYSQL_PASSWORD)"

BASE_DE_DATOS="${BASE_DE_DATOS:-golf_db}"
USUARIO="${USUARIO:-golf_user}"
[[ -n "$PASSWORD" ]] || fallar "MYSQL_PASSWORD está vacía en $FICHERO_ENV"

docker inspect "$CONTENEDOR_BD" >/dev/null 2>&1 \
  || fallar "el contenedor $CONTENEDOR_BD no existe"

[[ "$(docker inspect -f '{{.State.Running}}' "$CONTENEDOR_BD")" == "true" ]] \
  || fallar "el contenedor $CONTENEDOR_BD no está arrancado"

mkdir -p "$DIRECTORIO_BACKUPS"

# ------------------------------------------------------------------- volcado

FECHA="$(date +'%Y%m%d-%H%M%S')"
DESTINO="$DIRECTORIO_BACKUPS/caddex-$FECHA.sql.gz"
TEMPORAL="$DESTINO.parcial"

registrar "Volcando '$BASE_DE_DATOS' desde $CONTENEDOR_BD..."

# La contraseña va por variable de entorno (MYSQL_PWD) y no como argumento:
# un argumento se ve en la lista de procesos del contenedor.
#
# --single-transaction hace el volcado consistente sin bloquear escrituras,
# que con InnoDB es lo correcto para no cortar el servicio durante la copia.
if ! docker exec -e MYSQL_PWD="$PASSWORD" "$CONTENEDOR_BD" \
      mysqldump \
        --user="$USUARIO" \
        --single-transaction \
        --skip-lock-tables \
        --routines \
        --triggers \
        --default-character-set=utf8mb4 \
        "$BASE_DE_DATOS" 2>/tmp/caddex-mysqldump-error.log | gzip -9 > "$TEMPORAL"; then
  registrar "Salida de mysqldump:"
  sed 's/^/    /' /tmp/caddex-mysqldump-error.log >&2 || true
  rm -f "$TEMPORAL"
  fallar "mysqldump ha fallado"
fi

# --------------------------------------------------------------- verificación
#
# Un fichero creado no es una copia válida. Un volcado truncado pesa poco y
# parece correcto hasta el día que hace falta restaurarlo. Comprobamos que el
# gzip está íntegro y que dentro hay las tablas que esperamos.

registrar "Verificando el volcado..."

gzip -t "$TEMPORAL" 2>/dev/null || { rm -f "$TEMPORAL"; fallar "el fichero comprimido está corrupto"; }

TABLAS_ESPERADAS=(users rounds round_holes courses tournaments)
CONTENIDO="$(gunzip -c "$TEMPORAL")"

for tabla in "${TABLAS_ESPERADAS[@]}"; do
  grep -q "CREATE TABLE \`$tabla\`" <<<"$CONTENIDO" \
    || { rm -f "$TEMPORAL"; fallar "falta la tabla '$tabla' en el volcado: la copia no sirve"; }
done

# mysqldump cierra siempre con esta línea. Si no está, el volcado se cortó.
grep -q "Dump completed" <<<"$CONTENIDO" \
  || { rm -f "$TEMPORAL"; fallar "el volcado está truncado (falta la marca de cierre)"; }

USUARIOS="$(grep -c "INSERT INTO \`users\`" <<<"$CONTENIDO" || true)"
unset CONTENIDO

mv "$TEMPORAL" "$DESTINO"
TAMANO="$(du -h "$DESTINO" | cut -f1)"
registrar "Copia correcta: $DESTINO ($TAMANO, $USUARIOS sentencias de inserción en users)"

# ---------------------------------------------------------------- retención

registrar "Borrando copias de más de $DIAS_DE_RETENCION días..."
BORRADAS="$(find "$DIRECTORIO_BACKUPS" -name 'caddex-*.sql.gz' -type f -mtime "+$DIAS_DE_RETENCION" -print -delete | wc -l)"
registrar "Copias borradas: $BORRADAS"

TOTAL="$(find "$DIRECTORIO_BACKUPS" -name 'caddex-*.sql.gz' -type f | wc -l)"
registrar "Copias guardadas ahora mismo: $TOTAL"
registrar "=== Terminado ==="

# -----------------------------------------------------------------------------
# PENDIENTE, y es importante: sacar estas copias del servidor.
#
# Mientras vivan solo aquí, perder la instancia de Oracle sigue siendo perder
# los datos. Cualquiera de estas opciones vale:
#
#   - rclone a un almacenamiento externo (Backblaze B2, Drive, S3)
#   - scp a tu propio homelab
#   - Oracle Object Storage, que entra en la capa gratuita
#
# Añadir la línea correspondiente al final de este script cuando esté decidido.
