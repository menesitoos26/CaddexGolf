<div align="center">

# Caddex Golf

**Apunta. Analiza. Mejora.**

Registra tus rondas y torneos hoyo a hoyo, calcula tu hándicap con el método del
World Handicap System y descubre exactamente dónde estás perdiendo golpes.

Proyecto Final de Grado · Desarrollo de Aplicaciones Web (DAW)

</div>

---

## Qué hace

- **Cuentas de usuario.** Registro y login con contraseñas cifradas (bcrypt) y sesiones por token JWT.
- **Registro de rondas en dos modos.** *Hoyo a hoyo* (pensado para usar de pie en el campo: botones
  grandes, sin teclado, un hoyo por pantalla) o *tarjeta* completa en tabla, para anotar al terminar.
- **Datos por hoyo.** Golpes, par, putts, green en regulación y dispersión de la salida
  (izquierda / calle / derecha), que es lo que permite detectar un fallo sistemático.
- **Historial de rondas.** Listado paginado, detalle hoyo a hoyo con parciales de ida y vuelta, y borrado.
- **Torneos.** Agrupa varias rondas en una competición y consulta el acumulado y el puesto final.
- **Hándicap automático.** Se recalcula con cada ronda siguiendo el WHS (ver más abajo).
- **Estadísticas.** Evolución, reparto de resultados, media por tipo de hoyo, porcentajes de calle y
  green, dispersión desde el tee y rendimiento por campo.

---

## Arquitectura

```
                        Usuario (navegador)
                                │
                                ▼
                  ┌───────────────────────────┐
                  │  Nginx (proxy inverso)    │  ← único puerto expuesto
                  └───────────────────────────┘
                      │                   │
                  /  (web)           /api/  (API)
                      │                   │
                      ▼                   ▼
            ┌──────────────┐      ┌──────────────┐
            │   Frontend   │      │   Backend    │
            │ React + Vite │      │   FastAPI    │
            │ (nginx SPA)  │      │  SQLAlchemy  │
            └──────────────┘      └──────────────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │    MySQL     │
                                  └──────────────┘
```

### Estructura

```
backend/
  app/
    config.py      Configuración por variables de entorno
    database.py    Motor y sesión de SQLAlchemy
    models.py      Modelos ORM
    schemas.py     Contratos de entrada/salida (Pydantic)
    security.py    Hash de contraseñas y JWT
    deps.py        Dependencias (usuario autenticado)
    handicap.py    Cálculo del hándicap (WHS)
    services.py    Lógica de negocio y estadísticas
    routers/       auth · campos · rondas · torneos · estadisticas
  tests/           58 tests con pytest
frontend/
  src/
    api/           Cliente único de la API
    contexto/      Sesión y notificaciones
    componentes/   Encabezado, rutas protegidas, estados
    paginas/       Una carpeta por pantalla
    estilos/       Sistema de diseño (componentes.css)
    utils/         Formato y estilos de gráficas
docker/            docker-compose, init.sql, nginx y migraciones
```

---

## Puesta en marcha

### Opción A · En local, sin Docker

Necesitas Python 3.12+ y Node 20+. Usa SQLite, así que no hay que instalar ninguna base de datos.

**Backend:**

```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
```

Copia `backend/.env.example` a `backend/.env` y arranca:

```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000` y su documentación interactiva en `http://localhost:8000/docs`.

**Frontend** (en otra terminal):

```bash
cd frontend && npm install && npm run dev
```

La web queda en `http://localhost:5173`. Vite redirige `/api` al backend, así que no hay que configurar nada más.

### Opción B · Con Docker

Copia `docker/.env.example` a `docker/.env`, rellena las claves y levanta todo:

```bash
cd docker && docker compose up -d --build
```

> `JWT_SECRET_KEY`, `MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD` son obligatorias: si faltan, compose se niega a arrancar en vez de usar valores por defecto inseguros.

---

## Calidad

```bash
cd backend && .venv/Scripts/python -m pytest
```

```bash
cd backend && .venv/Scripts/python -m ruff check .
```

```bash
cd frontend && npm run lint
```

La CI de GitHub Actions ejecuta las tres cosas más la construcción de las imágenes Docker en cada push y cada PR a `main`.

---

## Cómo se calcula el hándicap

Se sigue el World Handicap System en su variante para jugadores sin hándicap oficial:

1. **Diferencial de cada ronda:** `(113 / slope) × (golpes ajustados − valoración del campo)`.
   Si no se conocen la valoración y el slope del campo se usan los valores neutros
   (valoración = par jugado, slope = 113), con lo que el diferencial queda en `golpes − par`.
2. **Tope por hoyo:** los golpes de cada hoyo se limitan a `par + 5`, el máximo que marca el WHS
   para jugadores sin hándicap establecido, para que un hoyo desastroso no distorsione el cálculo.
3. **Rondas de 9 hoyos:** el diferencial se escala a 18 para poder mezclarlas con las vueltas completas.
4. **Índice:** media de los N mejores diferenciales de las 20 rondas más recientes, según la tabla
   oficial del WHS (con 3 rondas se toma el mejor menos 2.0; con 20, la media de los 8 mejores).
   Hacen falta al menos 3 rondas y el índice se limita a 54.0.

La implementación está en [handicap.py](backend/app/handicap.py) y sus tests en
[test_handicap.py](backend/tests/test_handicap.py).

---

## Notas de seguridad

- Todos los endpoints de datos exigen un token JWT y filtran **siempre** por el usuario del token:
  ningún usuario puede leer ni modificar rondas o torneos de otro.
- Los totales de una ronda (par, golpes, putts) se calculan en el servidor a partir de la tarjeta;
  nunca se confía en los que envía el cliente.
- Cambiar el correo o la contraseña exige confirmar la contraseña actual.
- El login devuelve el mismo mensaje tanto si el correo no existe como si la contraseña es incorrecta,
  para no revelar qué correos están registrados.
- La clave de la API externa de campos vive en el backend, no en el bundle de JavaScript.
- La documentación interactiva (`/docs`) se desactiva sola cuando `ENVIRONMENT=production`.

---

## Migrar una base de datos anterior

Si ya tienes datos creados con el esquema antiguo, ejecuta la migración incluida
(haz una copia de seguridad antes):

```bash
docker exec caddex_db mysqldump -ugolf_user -pgolf_pass golf_db > copia.sql
```

```bash
docker exec -i caddex_db mysql -ugolf_user -pgolf_pass golf_db < docker/migraciones/001_esquema_v1_a_v2.sql
```

Y después, para añadir la dispersión de calle:

```bash
docker exec -i caddex_db mysql -ugolf_user -pgolf_pass golf_db < docker/migraciones/002_dispersion_de_calle.sql
```
