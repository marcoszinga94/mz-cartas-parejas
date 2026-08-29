# Especificación de diseño — Cartas Parejas

Fecha: 2026-08-28
Estado: Aprobado

## Resumen

Rediseño completo de un juego de cartas web para parejas. Se juega en el navegador de un móvil, dos jugadores se pasan el dispositivo. Cartas con preguntas y retos, marcador competitivo, cronómetro por carta y persistencia local. Se desarrolla desde cero con HTML, CSS y JavaScript puro (sin dependencias, sin backend).

## Decisiones clave aprobadas

- **Paleta:** Vino & Rosa (fondo #140e14, vino #6b2540, frambuesa #c8486e, rosa suave #e88ba8, lavanda #c9a8c8, texto #f4e9ee). Oscura, apta para uso nocturno.
- **Carta:** estilo "Degradado vino" (gradiente 160deg #2a0f22 → #6b2540), pastilla de categoría, botones Hecho/No hecho.
- **Cronómetro:** anillo circular que se consume; <10s se vuelve rojo, late y emite tic.
- **Marcador:** fijo arriba, turno resaltado.
- **Configuración:** asistente por pasos (nombres → categorías → tiempo/rondas).
- **Fin de partida:** pantalla de ganador con confeti; si hay empate, botón de ronda extra (el primer punto decide).
- **Micro-interacciones (todas):** corazones al sumar punto, vibración visual al revelar, sonidos de puntos+flip con botón de silencio, últimos segundos en rojo.
- **Sonido:** generado por síntesis Web Audio API (sin archivos). Solo efectos, sin música. Botón de silencio en partida.
- **PWA instalable:** service worker + manifest, offline completo tras primera visita.
- **Edición de cartas:** archivo JSON base + cartas del usuario. Editor integrado en la app con exportar/importar JSON, y guardado en localStorage.

## Arquitectura de archivos

```
CartasParejas/
├── index.html              # Estructura de pantallas
├── css/styles.css          # Estilo, paleta, animaciones
├── js/app.js               # Núcleo: estado, pantallas, turnos, puntos
├── js/cards.js             # Carga/mezcla de cartas y categorías
├── js/sound.js             # Efectos de sonido (Web Audio API)
├── js/timer.js             # Cronómetro de anillo circular
├── data/cartas.json        # Cartas base (250+)
├── data/cartas-usuario.json # Cartas del usuario (misma estructura)
├── manifest.webmanifest    # PWA
└── sw.js                   # Service worker (offline)
```

Sin librerías externas, sin CDN, fuentes del sistema. Todo offline tras primera carga.

## Mecánica del juego

- Dos jugadores con nombres editables (solo nombres, sin avatares).
- 5 categorías: Preguntas, Retos, Picante, Romantico, Loco. Se eligen antes de la partida (mínimo 1).
- Cartas de categorías seleccionadas, mezcladas. Si se agota el mazo, se re-mezcla (evita repetir la carta inmediatamente anterior).
- El jugador en turno ve una carta. Dos botones:
  - **Hecho** → +1 punto al jugador en turno.
  - **No hecho** → sin puntos.
  - En ambos casos pasa al siguiente jugador.
- Cronómetro configurable por carta (presets + personalizado). Al llegar a 0, se congela en rojo y el jugador decide.
- Partida infinita, o con límite de rondas configurable (rondas = turnos por jugador o total; se define como "rondas" = pareja de turnos).
- Finalización manual (botón "Finalizar") o automática al alcanzar el límite. Pantalla de ganador con confeti. Empate → ronda extra (primera carta donde se suma un punto decide; si nadie suma, se repite).
- Reinicio: "Jugar de nuevo" (misma config) y "Configurar otra partida" (vuelve al asistente).

## Pantallas

1. **Inicio:** título, botón Jugar, acceso a Mis cartas, ajuste de sonido.
2. **Asistente (3 pasos):** 1) nombres, 2) categorías, 3) tiempo por carta + rondas (opcional).
3. **Partida:** marcador superior fijo (nombres + puntos, turno resaltado), anillo cronómetro, carta central con degradado vino, botones Hecho/No hecho, botón finalizar, botón silencio.
4. **Fin de partida:** ganador, marcador final, botones Jugar de nuevo / Configurar otra partida. Si empate: banner + botón ronda extra.
5. **Mis cartas (editor):** lista de cartas del usuario, agregar/editar/borrar, campos categoría + texto, exportar JSON, importar JSON.

## Estado y persistencia (localStorage)

- `cp.p1` / `cp.p2`: nombres de jugadores.
- `cp.puntos`: puntos actuales durante la partida.
- `cp.config`: config activa (categorías, tiempo, rondas).
- `cp.misCartas`: array de cartas del usuario (editor integrado).
- `cp.sonido`: boolean silencio.
- `cp.enPartida`: estado de partida activa (para que recargar no pierda la partida).

## Flujo de cartas (edición sin programar)

- `data/cartas.json`: cartas base (mín. 50 por categoría, total 250+). Estructura: `{ categorias: [], cartas: [{id, categoria, texto}] }`. Editables a mano en cualquier editor de texto.
- `data/cartas-usuario.json`: mismo formato, cargado si existe en el hosting.
- Editor integrado "Mis cartas": agrega/edita/borra en localStorage.
- El juego mezcla: base + usuario (hosting) + localStorage.
- Exportar: descarga `cartas-usuario.json`. Importar: reemplaza/mezcla las cartas del usuario en localStorage.

## Sonido (Web Audio API, sin archivos)

- `pop` al ganar punto (tono dulce ascendente).
- `swish` al cambiar de carta.
- `tic` por segundo en últimos 10s.
- `timeout` al agotar tiempo.
- `confeti/ganador` al finalizar.
- Botón de silencio persiste en localStorage.

## Animaciones

- Carta nueva: entrada con fade + escala + leve rotación.
- Carta al responder: fade hacia el lado.
- Vibración visual: shake corto al revelar.
- Corazones: flotan desde la carta hasta el nombre del jugador que suma.
- Marcador: pop de escala al sumar.
- Anillo: consumo suave; latido en últimos 10s.
- Confeti: partículas al ganar.

## PWA / Offline

- `sw.js`: precache de todos los assets (cache-first). Instalación y activación.
- `manifest.webmanifest`: name "Cartas Parejas", theme_color vino, background #140e14, display standalone, iconos SVG/PNG.
- Viewport con safe-area (env(safe-area-inset-*)) para notch.
- Botones touch grandes, `user-select:none`, `-webkit-tap-highlight-color: transparent`.

## Compatibilidad

- Android (Chrome) e iOS (Safari): uso de prefijos -webkit- donde aplique, flexbox estándar, sin APIs modernas incompatibles. Se prioriza funcionalidad sobre pixel-perfect en edge cases.
- Sin exportación imprimible por ahora (descartado en alcance).