# Especificación de diseño — Cartas Parejas

Fecha: 2026-08-28
Estado: Aprobado
Última actualización: 2026-08-28 (refleja los cambios implementados: categoría Hot, ronda extra por "No hecho", botones invertidos, gesto de deslizar, reanudación de partida, service worker robusto)

## Resumen

Rediseño completo de un juego de cartas web para parejas. Se juega en el navegador de un móvil, dos jugadores se pasan el dispositivo. Cartas con preguntas y retos, marcador competitivo, cronómetro por carta y persistencia local. Se desarrolla desde cero con HTML, CSS y JavaScript puro (sin dependencias, sin backend).

## Decisiones clave aprobadas

- **Paleta:** Vino & Rosa (fondo #140e14, vino #6b2540, frambuesa #c8486e, rosa suave #e88ba8, lavanda #c9a8c8, texto #f4e9ee). Oscura, apta para uso nocturno.
- **Carta:** estilo "Degradado vino" (gradiente 160deg #2a0f22 → #6b2540), pastilla de categoría, botones Hecho/No hecho. La carta se puede **deslizar** para responder (gesto) y la salida es direccional.
- **Cronómetro:** anillo circular que se consume; <10s se vuelve rojo, late y emite tic.
- **Marcador:** fijo arriba, turno resaltado.
- **Configuración:** asistente por pasos (nombres → categorías → tiempo/rondas), con botón "Volver" que en el primer paso regresa a la pantalla de inicio.
- **Fin de partida:** pantalla de ganador con confeti; si hay empate, botón de ronda extra que se juega hasta que alguien marque "No hecho".
- **Micro-interacciones (todas):** corazones al sumar punto, vibración visual al revelar, sonidos de puntos+flip con botón de silencio, últimos segundos en rojo.
- **Sonido:** generado por síntesis Web Audio API (sin archivos). Solo efectos, sin música. Botón de silencio en partida. El contexto de audio se desbloquea con el primer gesto del usuario, ignorando el estado de silencio (requisito iOS).
- **PWA instalable:** service worker + manifest, offline completo tras primera visita, con precache de solo respuestas OK y fallback de navegación.
- **Edición de cartas:** archivo JSON base + cartas del usuario. Editor integrado en la app con exportar/importar JSON, y guardado en localStorage.
- **Reanudación de partida:** al recargar la página, la partida en curso se reanuda conservando puntos y turno (el mazo se baraja de nuevo, no se persiste).

## Arquitectura de archivos

```
CartasParejas/
├── index.html              # Estructura de pantallas
├── css/styles.css          # Estilo, paleta, animaciones
├── js/app.js               # Núcleo: estado, pantallas, turnos, puntos, swipe
├── js/cards.js             # Carga/mezcla de cartas y categorías (mazo rotatorio)
├── js/sound.js             # Efectos de sonido (Web Audio API)
├── js/timer.js             # Cronómetro de anillo circular
├── data/cartas.json        # Cartas base (300: 50 por categoría)
├── data/cartas-usuario.json # Cartas del usuario (misma estructura)
├── icons/                  # Iconos PWA (SVG + PNG 180/192/512)
├── manifest.webmanifest    # PWA
├── sw.js                   # Service worker (offline)
├── README.md               # Instrucciones para el cliente
└── tests/                  # Tests (node --test)
```

Sin librerías externas, sin CDN, fuentes del sistema. Todo offline tras primera carga.

## Mecánica del juego

- Dos jugadores con nombres editables (solo nombres, sin avatares).
- 6 categorías: Preguntas, Retos, Picante, Romantico, Loco, Hot. Se eligen antes de la partida (mínimo 1).
- Cartas de categorías seleccionadas, mezcladas. El mazo es **rotatorio**: la carta robada pasa al final, por lo que nunca se repite la carta inmediatamente anterior y se conservan todas las categorías (sin reconstrucción al agotarse).
- El jugador en turno ve una carta. Dos formas de responder:
  - **Botones:** "No hecho" (izquierda) y "Hecho" (derecha). Orden invertido a petición del cliente.
  - **Gesto de deslizar:** deslizar la carta a la derecha = Hecho, a la izquierda = No hecho. La carta sigue el dedo con rotación; un deslizamiento corto la devuelve al centro sin resolver.
  - **Hecho** → +1 punto al jugador en turno. **No hecho** → sin puntos. En ambos casos pasa al siguiente jugador. La animación de salida es direccional (hacia el lado elegido).
- Cronómetro configurable por carta (presets + personalizado). Al llegar a 0, se congela en rojo y el jugador decide.
- Partida infinita, o con límite de rondas configurable (rondas = turnos por jugador o total; se define como "rondas" = pareja de turnos).
- Finalización manual (botón "Finalizar") o automática al alcanzar el límite. Pantalla de ganador con confeti. Empate → **ronda extra**: los puntos se reinician y se juega hasta que alguno de los dos marque "No hecho"; marcar "Hecho" suma puntos y la ronda continúa. Al terminar, el que tenga más puntos gana (si vuelve a empatar, se ofrece otra ronda extra).
- Reinicio: "Jugar de nuevo" (misma config) y "Configurar otra partida" (vuelve al asistente).
- **Reanudación:** si se recarga la página durante una partida, la partida continúa con los puntos y el turno guardados (mazo nuevo).

## Pantallas

1. **Inicio:** título, botón Jugar, acceso a Mis cartas, ajuste de sonido.
2. **Asistente (3 pasos):** 1) nombres, 2) categorías (incluye "Hot"), 3) tiempo por carta + rondas (opcional). Botón "Volver" en el primer paso regresa a la pantalla de inicio.
3. **Partida:** marcador superior fijo (nombres + puntos, turno resaltado), anillo cronómetro, carta central con degradado vino deslizable, botones No hecho/Hecho (invertidos), botón finalizar, botón silencio.
4. **Fin de partida:** ganador, marcador final, botones Jugar de nuevo / Configurar otra partida. Si empate: banner + botón ronda extra.
5. **Mis cartas (editor):** lista de cartas del usuario, agregar/editar/borrar, campos categoría + texto, exportar JSON, importar JSON.

## Estado y persistencia (localStorage)

- `cp.estado`: objeto JSON con toda la partida (`p1`, `p2`, `puntos1`, `puntos2`, `turno`, `config`, `enPartida`, `misCartas`).
- `cp.sonido`: estado del silencio ('on'/'off').
- `cp.enPartida` se guarda dentro de `cp.estado` para que recargar la página reanude la partida en curso.

## Flujo de cartas (edición sin programar)

- `data/cartas.json`: cartas base (mín. 50 por categoría, total 300). Estructura: `{ categorias: [], cartas: [{id, categoria, texto}] }`. Editables a mano en cualquier editor de texto.
- `data/cartas-usuario.json`: mismo formato, cargado si existe en el hosting.
- Editor integrado "Mis cartas": agrega/edita/borra en localStorage.
- El juego mezcla: base + usuario (hosting) + localStorage.
- Exportar: descarga `cartas-usuario.json`. Importar: valida la estructura mínima, re-numera los ids y **fusiona** (anexa) las cartas del usuario en localStorage.

## Sonido (Web Audio API, sin archivos)

- `pop` al ganar punto (tono dulce ascendente).
- `swish` al cambiar de carta.
- `tic` por segundo en últimos 10s.
- `timeout` al agotar tiempo.
- `confeti/ganador` al finalizar.
- Botón de silencio persiste en localStorage.

## Animaciones

- Carta nueva: entrada con fade + escala + leve rotación.
- Carta al responder: fade hacia el lado elegido (salida direccional, derecha o izquierda).
- Gesto de deslizar: la carta sigue el dedo con `translateX` + rotación proporcional; al soltar más allá del umbral sale volando hacia ese lado, si es corto vuelve al centro.
- Vibración visual: shake corto al revelar.
- Corazones: flotan desde la carta hasta el nombre del jugador que suma.
- Marcador: pop de escala al sumar.
- Anillo: consumo suave; latido en últimos 10s.
- Confeti: partículas al ganar.
- `prefers-reduced-motion` respetado.

## PWA / Offline

- `sw.js`: precache de todos los assets (install) para garantizar el offline. Estrategia **network-first** en runtime: intenta la red y cachea la respuesta (solo respuestas OK), con fallback a caché si no hay conexión (y a `index.html` para navegaciones). Esto asegura que las actualizaciones de contenido lleguen siempre que haya red, sin depender de bumpear la versión de la caché. `skipWaiting` + `clients.claim`. Cache versionada (`cartas-parejas-v3`).
- `manifest.webmanifest`: name "Cartas Parejas", short_name "CartasParejas", `id`, `lang: es`, `description`, theme_color vino, background #140e14, display standalone, iconos SVG/PNG (192 y 512 con purpose "any maskable").
- Iconos: `icons/icon.svg` (corazón sobre gradiente vino) + PNG 180 (apple-touch-icon), 192 y 512.
- `<link rel="apple-touch-icon">` para instalación en iPhone.
- Viewport con safe-area (env(safe-area-inset-*)) para notch.
- Botones touch grandes, `user-select:none`, `-webkit-tap-highlight-color: transparent`, `touch-action: none` en la carta para el gesto de deslizar.

## Compatibilidad

- Android (Chrome) e iOS (Safari): uso de prefijos -webkit- donde aplique (incluye `webkitAudioContext`), flexbox estándar, sin APIs modernas incompatibles. Se prioriza funcionalidad sobre pixel-perfect en edge cases.
- El contexto de audio se desbloquea con el primer gesto del usuario (requisito iOS), ignorando el silencio.
- Sin exportación imprimible por ahora (descartado en alcance).

## Notas de implementación (cambios post-aprobación)

- **Mazo rotatorio:** se reemplazó la reconstrucción al agotarse por un mazo que rota la carta robada al final. La spec original asumía re-mezcla al vaciarse; el diseño rotatorio garantiza no repetir la carta inmediata anterior y conservar todas las categorías, eliminando el manejo de mazo vacío.
- **Categoría "Hot":** añadida a petición del cliente con 50 cartas de tono sexual explícito. Total base: 300 cartas.
- **Ronda extra:** cambiada de "el primer punto decide" a "se juega hasta que alguien marque No hecho".
- **Botones Hecho/No hecho:** invertidos (No hecho a la izquierda, Hecho a la derecha) a petición del cliente.
- **Gesto de deslizar:** añadido como método alternativo a los botones (derecha = Hecho, izquierda = No hecho).
- **Reanudación de partida:** al recargar, la partida en curso se reanuda con puntos y turno conservados.