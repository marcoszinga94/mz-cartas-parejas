# Especificación de diseño — Modo sexting online

Fecha: 2026-08-28
Estado: Aprobado
Complementa: docs/superpowers/specs/2026-08-28-cartas-parejas-design.md

## Resumen

Extiende "Cartas Parejas" con un modo online para parejas que no están en el mismo lugar: chat + juego sincronizado en tiempo real. Ambos se conectan mediante un código de 6 dígitos. El historial del chat es continuo por pareja, se guarda en Neon y se puede releer desde la app (estilo WhatsApp). Las fotos viajan solo en vivo y se guardan localmente.

## Decisiones clave aprobadas

- **Arquitectura:** Frontend estático (Vercel) + Vercel Functions (API serverless) + Neon (Postgres). El tiempo real se implementa con **polling corto (~1.5s)** contra la API, sin servicios externos de WebSocket.
- **Conversación continua por pareja:** una sola conversación por pareja; el código solo sirve para conectarse en vivo. El historial persiste hasta borrado manual.
- **Fotos:** se envían solo en vivo (base64 por el canal) y se guardan en `localStorage` del dispositivo receptor. Neon guarda `tipo='foto'`; el payload viaja en la fila solo entre el envío y la primera entrega en vivo, y se **elimina del servidor al ser entregado**. Las fotos quedan guardadas solo en cada teléfono.
- **Sala abierta:** al desconectarse, la sala queda abierta y se reanuda con el mismo código.
- **Juego:** misma carta sincronizada, turno alternado, cronómetro por carta igual al modo local. Solo el jugador en turno puede resolver.
- **Categorías:** todas las categorías disponibles (incluye Hot).
- **`DATABASE_URL`:** variable de entorno de Vercel. Nunca en código ni en GitHub.

## Arquitectura de archivos (nuevos)

```
CartasParejas/
├── api/
│   ├── pareja.js             # POST crear pareja
│   ├── sesion.js             # POST crear sala con código
│   ├── sesion-join.js        # POST unirse por código
│   ├── sesion-estado.js      # GET estado sincronizado de la sala
│   ├── sesion-turno.js       # POST resolver carta
│   ├── mensajes.js           # POST enviar / GET nuevos mensajes
│   ├── chats.js              # GET lista conversaciones / DELETE borrar
│   └── _db.js                # Pool de conexión a Neon (compartido)
├── js/online.js              # Cliente online: polling, sala, chat
└── index.html                # Botón "Modo online", pantallas online + chat
```

## Modelo de datos (Neon)

### `parejas`
| columna | tipo | notas |
|---|---|---|
| id | serial / uuid PK | |
| creada_at | timestamptz default now() | |

### `mensajes`
| columna | tipo | notas |
|---|---|---|
| id | serial PK | |
| pareja_id | int FK → parejas | |
| autor_id | text | dispositivo_id del emisor |
| tipo | text | 'texto' \| 'foto' |
| contenido | text | texto del mensaje; para fotos, el payload viaja en vivo y se vacía al entregarse |
| creada_at | timestamptz default now() | |

### `sesiones`
| columna | tipo | notas |
|---|---|---|
| id | serial PK | |
| pareja_id | int FK → parejas | |
| codigo | text unique | 6 dígitos (ej. "483920") |
| creador_id | text | dispositivo_id del creador |
| jugador2_id | text nullable | dispositivo_id del que se unió |
| estado | text | 'espera' \| 'jugando' |
| turno | int | 1 o 2 |
| categoria | text | categoría activa de la carta actual |
| carta_texto | text | texto de la carta actual |
| puntos1 | int default 0 | |
| puntos2 | int default 0 | |
| creada_at | timestamptz default now() | |

## API (Vercel Functions)

Todas reciben/responden JSON. Errores con `{ error: "mensaje" }` + status HTTP apropiado.

- **`POST /api/pareja`** `{ dispositivo_id }` → `{ pareja_id }` (crea pareja nueva).
- **`POST /api/sesion`** `{ pareja_id, dispositivo_id, nombre }` → `{ codigo, sesion_id }`. Crea sala en estado 'espera'. Si la pareja ya tiene una sala abierta, la reutiliza (misma sesión_id).
- **`POST /api/sesion-join`** `{ codigo, dispositivo_id, nombre }` → `{ sesion_id, pareja_id }`. Une al jugador 2; si la sala está en 'jugando', se reanuda el estado.
- **`GET /api/sesion-estado?sesion_id=`** → `{ estado, turno, categoria, carta_texto, puntos1, puntos2, jugadores: {1: nombre, 2: nombre} }`.
- **`POST /api/sesion-turno`** `{ sesion_id, dispositivo_id, hecho }` → nuevo estado. Solo resuelve si es el turno de `dispositivo_id`. Si `hecho` → suma 1 punto al jugador en turno; cambia `carta_texto` (nueva carta aleatoria de `categoria`) y alterna `turno`. Si la categoría activa no está definida al comenzar, el creador la elige al crear la sala y se pasa por el estado.
- **`POST /api/mensajes`** `{ pareja_id, autor_id, tipo, contenido }` → `{ id }`. Para `tipo='foto'`, `contenido` debe ser un data URL `data:image/` de máximo ~1MB base64 (si no, 400).
- **`GET /api/mensajes?pareja_id=&after=&dispositivo_id=`** → `{ mensajes: [...] }` con `id > after`. Requiere un `dispositivo_id` que sea miembro de la pareja (creador o jugador 2 de alguna sesión); si no, 403. Al entregar fotos a un dispositivo que no es el autor, el servidor **vacía su `contenido`** (la foto solo vive en Neon entre el envío y su primera entrega).
- **`GET /api/chats?dispositivo_id=`** → `{ chats: [{ pareja_id, ultimo_mensaje, actualizado_at }] }` (para la lista "Mis chats").
- **`DELETE /api/chats/:pareja_id?dispositivo_id=`** → `{ ok: true }` (borra conversación y sus mensajes). Requiere `dispositivo_id` miembro de la pareja; si no, 403.

## Cliente online (`js/online.js`)

Módulo ES que importa lo necesario de `app.js` (o expone hooks). Responsabilidades:

- **Conexión:** `crearSala()`, `unirseSala(codigo)`, `reanudarSala()` (última sesión).
- **Polling:** `setInterval` ~1.5s consulta `GET /api/sesion-estado` y `GET /api/mensajes?after=ultimoId`. Actualiza pantalla si cambió. Se pausa cuando la pestaña no está visible (visibilitychange) y se reanuda al volver.
- **Resolución:** cuando el jugador en turno pulsa Hecho/No hecho, `POST /api/sesion-turno`; el estado vuelve por polling a ambos.
- **Turno bloqueado:** el jugador fuera de turno ve la carta pero los botones deshabilitados.
- **Chat:** pantalla de chat con burbujas (texto + fotos), timestamps, input de texto y botón de foto (captura/galería vía `<input type="file">` → base64 → se envía en vivo y se guarda local). El historial se carga de `localStorage` (`cp.chat_local`) + se completa con los mensajes de Neon.
- **Estado de conexión:** banner "conectado/desconectado/reconectando" según el resultado de los polls.

## Persistencia local (localStorage)

- `cp.dispositivo_id` — identidad persistente del teléfono (generada al primer uso).
- `cp.pareja_id` — pareja vinculada (para la conversación continua).
- `cp.ultimaSesion` — `{ sesion_id, codigo, pareja_id }` para reanudar.
- `cp.chat_local` — array de mensajes de la pareja en este teléfono (texto + fotos base64), estilo WhatsApp.

## Pantallas nuevas

1. **Inicio:** nuevo botón "Modo online".
2. **Modo online (hub):** opciones "Crear código", "Unirme con código", "Reanudar última sesión" (si existe), y acceso "Mis chats".
3. **Sala de espera:** código grande para compartir, lista de jugadores (creador esperando al 2). Cuando el segundo jugador se une, la partida **arranca sola** en ambos teléfonos (no hay botón "Comenzar").
4. **Partida online:** misma UI de partida local (marcador, anillo, carta, botones) + banner de conexión + botón flotante de chat. Botones deshabilitados fuera de turno.
5. **Chat:** burbujas, input texto, botón foto, timestamps. Accesible desde la sala y desde "Mis chats".
6. **Mis chats:** lista de conversaciones (pareja, último mensaje, fecha). Al abrir una, muestra el historial completo (local + Neon). Botón borrar.

## Tiempo real y errores

- Polling cada 1.5s; si un poll falla, se muestra "desconectado" y se reintenta (backoff simple hasta 10s). Se reanuda automáticamente.
- La sala queda abierta: al reconectar con el mismo código o reanudar la última sesión, se retoma donde iba (estado del servidor es la fuente de verdad).
- Contenido del chat cifrado en tránsito por HTTPS; no hay cifrado E2E (fuera de alcance).

## Compatibilidad y rendimiento

- Igual que el modo local: móvil-first, touch, sin librerías.
- El polling de mensajes trae solo `id > after` (payload mínimo).
- Las fotos se escalan/comprimen a base64 antes de enviar (máx ~1MB) para no saturar el canal. El servidor las valida y las vacía tras la entrega: una foto vive en Neon solo entre el envío y su primera entrega en vivo.

## Fuera de alcance

- Cifrado extremo a extremo.
- Registro de usuarios con contraseña.
- Notificaciones push.
- Borrado automático por tiempo (los chats persisten hasta borrado manual).