# Cartas Parejas — Rediseño Premium (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir desde cero un juego de cartas web para parejas, 100% estático, offline, instalable como PWA, con editor de cartas integrado y estética premium "Vino & Rosa".

**Architecture:** Página única (SPA) sin frameworks. ES modules puros en el navegador (compatibles con Node para tests). Lógica de dominio (cartas, cronómetro, estado) en módulos independientes y testeables; `app.js` solo orquesta DOM. Datos de cartas en JSON editables. Service worker + manifest para PWA. Sonidos sintetizados con Web Audio API (cero archivos de audio).

**Tech Stack:** HTML5, CSS3 (variables, flexbox, keyframes), Vanilla JS (ES modules), Web Audio API, PWA (manifest + service worker), Node v26 `node --test` para tests, localStorage para persistencia.

**Spec:** `docs/superpowers/specs/2026-08-28-cartas-parejas-design.md`

## Global Constraints

- Sin librerías, sin CDN, sin build tools, sin framework. Solo HTML/CSS/JS.
- Todo el código y textos de UI en español (etiquetas, botones, mensajes).
- Paleta fija (Vino & Rosa): fondo `#140e14`, vino `#6b2540`, frambuesa `#c8486e`, rosa suave `#e88ba8`, lavanda `#c9a8c8`, texto `#f4e9ee`.
- Carta "Degradado vino": gradiente `linear-gradient(160deg, #2a0f22, #6b2540)`, esquinas `18px`.
- ES modules en todos los `.js`. Código en inglés (identificadores), textos UI en español.
- localStorage keys con prefijo `cp.`.
- `data/cartas.json`: mínimo 50 cartas por categoría (5 categorías: Preguntas, Retos, Picante, Romantico, Loco). Estructura: `{ categorias: [...], cartas: [{id, categoria, texto}] }`.
- `data/cartas-usuario.json`: mismo formato exacto que `cartas.json`.
- El juego debe funcionar offline tras la primera carga. Todo asset referenciado en `index.html` debe estar en el precache de `sw.js`.
- Touch-first: botones ≥48px, `user-select:none`, `-webkit-tap-highlight-color: transparent`, safe-area (`env(safe-area-inset-*)`).
- Tests se ejecutan con `node --test tests/`.

---

### Task 1: Inicialización del proyecto y setup de tests

**Files:**
- Create: `package.json`
- Create: `tests/helpers.test.js`
- Create: `.gitignore`
- Delete: `-l` (archivo residual en la raíz)

**Interfaces:**
- Consumes: nada.
- Produces: comando `npm test` que ejecuta `node --test tests/`. Ejemplo de test que verifica el runner.

- [ ] **Step 1: Limpiar y crear la estructura base**

```bash
rm -f /home/marcoszinga/PROGRAMAS/CartasParejas/-l
mkdir -p /home/marcoszinga/PROGRAMAS/CartasParejas/{css,js,data,tests}
cd /home/marcoszinga/PROGRAMAS/CartasParejas && git init
```

- [ ] **Step 2: Escribir `package.json`**

```json
{
  "name": "cartas-parejas",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Escribir `.gitignore`**

```
.superpowers/
node_modules/
```

- [ ] **Step 4: Escribir el test del runner**

`tests/helpers.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

export function sumar(a, b) { return a + b; }

test('runner funciona', () => {
  assert.equal(sumar(2, 2), 4);
});
```

- [ ] **Step 5: Ejecutar y verificar**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: inicializar proyecto y runner de tests"
```

---

### Task 2: Lógica de cartas (`js/cards.js`)

**Files:**
- Create: `js/cards.js`
- Create: `tests/cards.test.js`

**Interfaces:**
- Consumes: nada (lógica pura).
- Produces:
  - `export function mezclarDeck(merged, categorias)` → `Array<{id,categoria,texto}>` filtrado por categorías seleccionadas y barajado.
  - `export function robarCarta(deck, prevId)` → `{ carta, deck }` donde `deck` es el mazo restante (se re-baraja sin repetir `prevId` cuando se agota).
  - `export function mergeCards(base, usuario)` → `Array<{id,categoria,texto}>` donde `usuario` se anexa y se re-numeran los ids empezando en el máximo+1 de base.

- [ ] **Step 1: Escribir el test**

`tests/cards.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCards, mezclarDeck, robarCarta } from '../js/cards.js';

const base = { categorias: ['Preguntas', 'Retos'], cartas: [
  { id: 1, categoria: 'Preguntas', texto: 'P1' },
  { id: 2, categoria: 'Retos', texto: 'R1' },
  { id: 3, categoria: 'Preguntas', texto: 'P2' },
] };

test('mergeCards re-numera y anexa las del usuario', () => {
  const usuario = { categorias: ['Loco'], cartas: [
    { id: 1, categoria: 'Loco', texto: 'L1' },
  ]};
  const res = mergeCards(base.cartas, usuario.cartas);
  assert.equal(res.length, 4);
  assert.equal(res[3].texto, 'L1');
  assert.equal(res[3].id, 4);
});

test('mezclarDeck filtra por categorias y baraja', () => {
  const res = mezclarDeck(mergeCards(base.cartas, []), ['Preguntas']);
  assert.equal(res.length, 2);
  assert.ok(res.every(c => c.categoria === 'Preguntas'));
});

test('robarCarta agota mazo, re-baraja sin repetir la anterior', () => {
  const deck = mezclarDeck(mergeCards(base.cartas, []), ['Preguntas', 'Retos']);
  const ids = new Set();
  let prevId = null;
  let restante = deck;
  for (let i = 0; i < 30; i++) {
    const { carta, deck: d } = robarCarta(restante, prevId);
    assert.notEqual(carta.id, prevId);
    ids.add(carta.id);
    prevId = carta.id;
    restante = d;
  }
  assert.ok(ids.has(1) && ids.has(2) && ids.has(3));
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/cards.test.js`
Expected: FAIL con "Cannot find module '../js/cards.js'".

- [ ] **Step 3: Implementar `js/cards.js`**

```js
export function mergeCards(base, usuario) {
  const maxId = base.reduce((m, c) => Math.max(m, c.id), 0);
  const anexadas = (usuario || []).map((c, i) => ({ ...c, id: maxId + i + 1 }));
  return [...base, ...anexadas];
}

export function mezclarDeck(merged, categorias) {
  const filtradas = merged.filter(c => categorias.includes(c.categoria));
  const barajadas = [...filtradas];
  for (let i = barajadas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [barajadas[i], barajadas[j]] = [barajadas[j], barajadas[i]];
  }
  return barajadas;
}

export function robarCarta(deck, prevId) {
  if (deck.length === 0) {
    throw new Error('Mazo vacío');
  }
  const [carta, ...resto] = deck;
  if (resto.length === 0) {
    const rebarajado = mezclarDeck([...resto, carta], [carta.categoria])
      .filter(c => c.id !== prevId);
    return { carta, deck: rebarajado };
  }
  return { carta, deck: resto };
}
```

Nota: al agotarse, se re-baraja el mazo completo excluyendo la carta anterior para evitar repetición inmediata.

> **Nota de revisión final (supersede el snippet de arriba):** la implementación que se entregó usa un diseño de mazo rotatorio (`robarCarta(deck, prevId)` devuelve `{carta, deck}` moviendo la carta robada al final del mazo, re-mezclando solo si la carta de arriba repetiría la anterior). El mazo nunca se re-shufflea entre pasadas completas, nunca descarta cartas y nunca repite la carta inmediata; el snippet anterior (re-barajado al agotarse) quedó superado.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `node --test tests/cards.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/cards.js tests/cards.test.js
git commit -m "feat: logica de mazo y mezcla de cartas"
```

---

### Task 3: Datos de cartas base (`data/cartas.json`)

**Files:**
- Create: `data/cartas.json`
- Create: `data/cartas-usuario.json`
- Create: `tests/data.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `data/cartas.json` con estructura `{ categorias: [...], cartas: [{id, categoria, texto}] }` y ≥50 cartas por cada una de las 5 categorías (total ≥250). `data/cartas-usuario.json` con la misma estructura, `cartas: []`.

- [ ] **Step 1: Escribir el test de estructura de datos**

`tests/data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../data/cartas.json', import.meta.url), 'utf8'));
const usuario = JSON.parse(readFileSync(new URL('../data/cartas-usuario.json', import.meta.url), 'utf8'));

test('cartas base: 5 categorias y >=50 cartas por categoria', () => {
  assert.deepEqual(base.categorias.sort(), ['Loco', 'Picante', 'Preguntas', 'Retos', 'Romantico'].sort());
  for (const cat of base.categorias) {
    const n = base.cartas.filter(c => c.categoria === cat).length;
    assert.ok(n >= 50, `${cat} tiene ${n} cartas (min 50)`);
  }
});

test('todas las cartas tienen id unico, categoria valida y texto no vacio', () => {
  const ids = new Set(base.cartas.map(c => c.id));
  assert.equal(ids.size, base.cartas.length);
  for (const c of base.cartas) {
    assert.ok(base.categorias.includes(c.categoria));
    assert.ok(typeof c.texto === 'string' && c.texto.trim().length > 0);
  }
});

test('cartas-usuario tiene el mismo formato con cartas vacias', () => {
  assert.deepEqual(usuario.categorias, base.categorias);
  assert.ok(Array.isArray(usuario.cartas));
});
```

- [ ] **Step 2: Escribir el JSON base**

Escribir `data/cartas.json` completo: 5 categorías y **50 cartas por categoría** (250 totales), textos en español, variados y apropiados para parejas. Categorías y ejemplos de tono:

- **Preguntas**: "¿Cuál fue nuestro primer beso?", "¿Qué fue lo primero que pensaste de mí?"
- **Retos**: "Baila 30 segundos con música", "Hazme un masaje de manos durante 1 minuto"
- **Picante**: "Dime tu fantasía favorita", "Dame un beso en el cuello"
- **Romantico**: "Recítame algo bonito al oído", "Baila conmigo sin música"
- **Loco**: "Habla con acento extranjero durante 3 turnos", "Haz una foto rara y ponla de fondo"

El archivo debe incluir comentarios JSON no estándar? No — JSON no admite comentarios. La guía para el cliente irá en `README.md` (Task 11). Aquí solo datos válidos. ids correlativos de 1 a 250.

- [ ] **Step 3: Escribir `data/cartas-usuario.json`**

```json
{
  "categorias": ["Preguntas", "Retos", "Picante", "Romantico", "Loco"],
  "cartas": []
}
```

- [ ] **Step 4: Ejecutar y verificar**

Run: `npm test`
Expected: PASS (tests de datos incluidos).

- [ ] **Step 5: Commit**

```bash
git add data/cartas.json data/cartas-usuario.json tests/data.test.js
git commit -m "feat: 250 cartas base y plantilla de cartas de usuario"
```

---

### Task 4: Cronómetro (`js/timer.js`)

**Files:**
- Create: `js/timer.js`
- Create: `tests/timer.test.js`

**Interfaces:**
- Consumes: nada (lógica pura).
- Produces:
  - `export function formatTiempo(segundos)` → `"45"` o `"1:05"` (mm:ss si ≥60s).
  - `export function fraccionAnillo(total, restante)` → número 0..1 (restante/total, clamp).
  - `export function esTension(restante, umbral=10)` → `boolean` (restante ≤ umbral).

- [ ] **Step 1: Escribir el test**

`tests/timer.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTiempo, fraccionAnillo, esTension } from '../js/timer.js';

test('formatTiempo formatea <60s y >=60s', () => {
  assert.equal(formatTiempo(45), '45');
  assert.equal(formatTiempo(9), '9');
  assert.equal(formatTiempo(65), '1:05');
  assert.equal(formatTiempo(120), '2:00');
});

test('fraccionAnillo clampa 0..1', () => {
  assert.equal(fraccionAnillo(60, 60), 1);
  assert.equal(fraccionAnillo(60, 30), 0.5);
  assert.equal(fraccionAnillo(60, 0), 0);
  assert.equal(fraccionAnillo(60, -5), 0);
  assert.equal(fraccionAnillo(60, 99), 1);
});

test('esTension activa en el umbral', () => {
  assert.equal(esTension(10), true);
  assert.equal(esTension(11), false);
  assert.equal(esTension(0), true);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/timer.test.js`
Expected: FAIL con "Cannot find module '../js/timer.js'".

- [ ] **Step 3: Implementar `js/timer.js`**

```js
export function formatTiempo(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  if (s < 60) return String(s);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fraccionAnillo(total, restante) {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, restante / total));
}

export function esTension(restante, umbral = 10) {
  return restante <= umbral;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `node --test tests/timer.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/timer.js tests/timer.test.js
git commit -m "feat: helpers de cronometro"
```

---

### Task 5: Sonido (`js/sound.js`)

**Files:**
- Create: `js/sound.js`
- Create: `tests/sound.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export class Sonidos { constructor() {} activo: boolean; tocar(nombre); setActivo(bool); }`
  - Métodos: `tocar('punto' | 'flip' | 'tic' | 'timeout' | 'fin')`.
  - `export function puedeUsarAudio()` → `boolean` (navigator.userActivation disponible y activo, o true en desktop).

- [ ] **Step 1: Escribir el test**

`tests/sound.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeUsarAudio } from '../js/sound.js';

test('puedeUsarAudio devuelve boolean', () => {
  assert.equal(typeof puedeUsarAudio(), 'boolean');
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/sound.test.js`
Expected: FAIL con "Cannot find module '../js/sound.js'".

- [ ] **Step 3: Implementar `js/sound.js`**

```js
let audioCtx = null;

export function puedeUsarAudio() {
  return typeof window !== 'undefined'
    ? !!navigator.userActivation?.isActive
    : true;
}

function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tono(ctx, { freq, start, dur, type = 'sine', vol = 0.15, freqEnd }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + start + dur);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

export class Sonidos {
  constructor() {
    this.activo = true;
  }
  setActivo(v) { this.activo = !!v; }
  tocar(nombre) {
    if (!this.activo || typeof window === 'undefined') return;
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (nombre) {
      case 'punto':
        tono(ctx, { freq: 523.25, start: 0, dur: 0.12, type: 'sine', vol: 0.2 });
        tono(ctx, { freq: 783.99, start: 0.09, dur: 0.2, type: 'sine', vol: 0.18 });
        break;
      case 'flip':
        tono(ctx, { freq: 300, start: 0, dur: 0.08, type: 'triangle', vol: 0.12, freqEnd: 600 });
        break;
      case 'tic':
        tono(ctx, { freq: 880, start: 0, dur: 0.05, type: 'square', vol: 0.05 });
        break;
      case 'timeout':
        tono(ctx, { freq: 392, start: 0, dur: 0.25, type: 'sawtooth', vol: 0.15, freqEnd: 220 });
        break;
      case 'fin':
        tono(ctx, { freq: 523.25, start: 0, dur: 0.15, type: 'sine', vol: 0.18 });
        tono(ctx, { freq: 659.25, start: 0.12, dur: 0.15, type: 'sine', vol: 0.18 });
        tono(ctx, { freq: 783.99, start: 0.24, dur: 0.3, type: 'sine', vol: 0.2 });
        break;
    }
  }
}
```

Nota: `window.AudioContext || window.webkitAudioContext` cubre iOS Safari (que usa prefijo `webkit`).

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `node --test tests/sound.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/sound.js tests/sound.test.js
git commit -m "feat: efectos de sonido sintetizados"
```

---

### Task 6: Estructura HTML y CSS base (todas las pantallas)

**Files:**
- Create: `index.html`
- Create: `css/styles.css`

**Interfaces:**
- Consumes: clases de las pantallas (definidas aquí), paleta de la spec.
- Produces: marcado estático de las 5 pantallas (Inicio, Asistente×3 pasos, Partida, Fin, Mis cartas) con `id` y clases estándar; variable CSS `--bg`, `--vino`, `--frambuesa`, `--rosa`, `--lavanda`, `--texto`. Clases de utilidad: `.pantalla`, `.oculto`, `.boton`, `.boton-primario`, `.boton-secundario`, `.chip`, `.chip-activo`.

- [ ] **Step 1: Escribir `index.html`**

Estructura mínima con `<link rel="manifest">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<script type="module" src="js/app.js">` al final de `<body>`. Contenedores por pantalla con `id="pantalla-inicio"`, `id="pantalla-asistente"`, `id="pantalla-partida"`, `id="pantalla-fin"`, `id="pantalla-miscartas"`. Dentro de partida: marcador (`#marcador-p1`, `#marcador-p2`, con datos `data-turno`), anillo SVG (`#anillo` con `#anillo-arc` y `#anillo-tiempo`), carta (`#carta` con `#carta-categoria`, `#carta-texto`), botones `#btn-hecho`, `#btn-no-hecho`, `#btn-finalizar`, `#btn-silencio`. El SVG del anillo:

```html
<svg id="anillo" viewBox="0 0 36 36" aria-hidden="true">
  <path id="anillo-fondo" d="M18 2 a16 16 0 0 1 0 32 a16 16 0 0 1 0 -32" fill="none" stroke="var(--vino)" stroke-width="3.5"/>
  <path id="anillo-arc" d="M18 2 a16 16 0 0 1 0 32 a16 16 0 0 1 0 -32" fill="none" stroke="var(--frambuesa)" stroke-width="3.5" stroke-linecap="round"/>
</svg>
<div id="anillo-tiempo">45</div>
```

- [ ] **Step 2: Escribir `css/styles.css`**

Reset básico, paleta en `:root`, body oscuro (`background:#140e14; color:var(--texto);`), tipografía de sistema. Reglas para: `.pantalla` (flex column centrada, min-height 100dvh, padding con safe-area), `.oculto { display:none !important; }`, botones (≥48px, radius 12-14px), chips de categoría, marcador (flex, turno resaltado con borde/glow frambuesa), carta con degradado vino, animaciones clave (`@keyframes entrarCarta` fade+scale+rotate, `@keyframes salirCarta`, `@keyframes shake`, `@keyframes pop`, `@keyframes flotarCorazon`, `@keyframes latir`, `@keyframes confeti`). Clase `.tension` para el anillo en rojo. Clase `.silencio-off` sobre el botón de silencio cuando mute está activo.

- [ ] **Step 3: Verificación visual local**

Servir localmente y abrir en navegador:

```bash
cd /home/marcoszinga/PROGRAMAS/CartasParejas && python3 -m http.server 8080
```

Expected: la página carga, muestra pantalla de inicio con estilos vino/rosa, sin errores de consola. (El servidor se detiene al terminar; usar `Ctrl+C` en sesión interactiva o un `timeout`.)

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: estructura HTML y estilos base"
```

---

### Task 7: Núcleo de la app — navegación, estado y persistencia (`js/app.js`)

**Files:**
- Create: `js/app.js`
- Create: `tests/estado.test.js`

**Interfaces:**
- Consumes: `mergeCards`, `mezclarDeck`, `robarCarta` (cards.js); `Sonidos`, `puedeUsarAudio` (sound.js); `formatTiempo`, `fraccionAnillo`, `esTension` (timer.js); pantallas y clases de index.html.
- Produces:
  - `export function estadoInicial()` → `{ p1, p2, puntos1, puntos2, turno, config, enPartida }`.
  - `export function guardarEstado(s)` → persistencia en localStorage.
  - `export function cargarEstado()` → restaura o devuelve `estadoInicial()`.
  - Funciones de navegación globales `mostrarPantalla(nombre)` expuestas en `window` para los onclick del HTML.
  - Carga asíncrona de `data/cartas.json` y `data/cartas-usuario.json` vía `fetch` con fallback a cartas integradas si el fetch falla (offline).

- [ ] **Step 1: Escribir el test de estado**

`tests/estado.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, guardarEstado, cargarEstado } from '../js/app.js';

test('estadoInicial tiene la forma correcta', () => {
  const s = estadoInicial();
  assert.equal(s.p1, 'Jugador 1');
  assert.equal(s.p2, 'Jugador 2');
  assert.equal(s.puntos1, 0);
  assert.equal(s.puntos2, 0);
  assert.equal(s.turno, 1);
  assert.equal(s.enPartida, false);
});

test('guardar/cargar estado sobrevive', () => {
  guardarEstado({ p1: 'A', p2: 'B', puntos1: 3, puntos2: 1, turno: 2, config: { tiempo: 45 }, enPartida: true });
  const s = cargarEstado();
  assert.equal(s.p1, 'A');
  assert.equal(s.puntos1, 3);
  assert.equal(s.turno, 2);
  assert.equal(s.enPartida, true);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/estado.test.js`
Expected: FAIL (no existe el módulo / no exporta).

- [ ] **Step 3: Implementar las funciones puras de estado**

En `js/app.js`, al inicio, exportar las funciones puras. `guardarEstado`/`cargarEstado` deben funcionar en Node sin `window` (guardar en variable en memoria si no hay localStorage) y en navegador con localStorage:

```js
import { mergeCards, mezclarDeck, robarCarta } from './cards.js';
import { Sonidos, puedeUsarAudio } from './sound.js';
import { formatTiempo, fraccionAnillo, esTension } from './timer.js';

export function estadoInicial() {
  return {
    p1: 'Jugador 1', p2: 'Jugador 2',
    puntos1: 0, puntos2: 0,
    turno: 1,
    config: { categorias: [], tiempo: 45, rondas: 0 },
    enPartida: false,
  };
}

const mem = {};
function lsGet(k) { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : (mem[k] ?? null); }
function lsSet(k, v) { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); else mem[k] = v; }

export function guardarEstado(s) {
  lsSet('cp.estado', JSON.stringify(s));
}

export function cargarEstado() {
  try {
    const raw = lsGet('cp.estado');
    if (!raw) return estadoInicial();
    return { ...estadoInicial(), ...JSON.parse(raw) };
  } catch {
    return estadoInicial();
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `node --test tests/estado.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Implementar el resto de `js/app.js` (navegación, sonido, carga de cartas, botones del asistente)**

En el mismo archivo, agregar (la lógica de partida completa llega en Task 8):
- `mostrarPantalla(nombre)` → oculta todas `.pantalla`, muestra la indicada; expuesto en `window`.
- Estado global `let estado = cargarEstado();`.
- `Sonidos` instanciado y sincronizado con `cp.sonido`.
- `puedeUsarAudio()`: en iOS, el contexto de audio solo se desbloquea tras gesto; añadir listener de primer `pointerdown`/`touchstart` que llama `sonidos.tocar('flip')` para desbloquear (con silencio ignorado).
- Carga asíncrona de cartas: `fetch('./data/cartas.json')` y `fetch('./data/cartas-usuario.json')`; si fallan (offline en primera carga), usar arrays vacíos. Guardar en variable `cartasBase`/`cartasUsuario`.
- Botones de asistente: nombres (`#input-p1`, `#input-p2`), chips de categoría (toggle `.chip-activo`), pasos anterior/siguiente, tiempo presets (15/30/45/60s), rondas (0 = infinito). Al llegar al paso 3 y pulsar "Comenzar", construir `estado.config`, `estado.enPartida = true`, guardar y llamar `iniciarPartida()` (definida en Task 8, llamada vía guard de existencia).

```js
window.mostrarPantalla = mostrarPantalla;
```

- [ ] **Step 6: Verificación en navegador**

Con el `http.server` de Task 6 activo: pasar los 3 pasos del asistente, guardar/reload la página y verificar que vuelve al inicio con nombres/categorías recordados.
Expected: sin errores de consola; la configuración persiste tras recargar.

- [ ] **Step 7: Commit**

```bash
git add js/app.js tests/estado.test.js
git commit -m "feat: nucleo de estado, navegacion y carga de cartas"
```

---

### Task 8: Pantalla de partida — turnos, puntos, cronómetro y animaciones

**Files:**
- Modify: `js/app.js` (añadir lógica de partida)
- Modify: `css/styles.css` (animaciones de partida, si faltan)

**Interfaces:**
- Consumes: `robarCarta`, `mezclarDeck` (cards.js); `formatTiempo`, `fraccionAnillo`, `esTension` (timer.js); `Sonidos` (sound.js); marcado de la pantalla partida (Task 6).
- Produces: función global `window.iniciarPartida()`; lógica de repartir carta, `resolverCarta(hecho)`, render del marcador, render del anillo, gestor del cronómetro (`setInterval` + `clearInterval`), finalizar partida → `mostrarFin()`.

- [ ] **Step 1: Implementar la lógica de partida en `js/app.js`**

Funciones:
- `iniciarPartida()`: construye `mazo = mezclarDeck(mergeCards(cartasBase, cartasUsuario), estado.config.categorias)`, `prevId = null`, render inicial, arranca cronómetro. Expuesta en `window`.
- `repartirCarta()`: `robarCarta(mazo, prevId)` → actualiza `prevId`, renderiza `#carta-categoria`/`#carta-texto`, reinicia cronómetro. Aplica animación `entrarCarta` (re-fuerza con `void el.offsetWidth` para re-disparar).
- `renderMarcador()`: pinta nombres y puntos, resalta el turno con clase `.turno-activo` y botón de "Finalizar" visible. `data-turno` para CSS.
- `resolverCarta(hecho)`: si `hecho` → `estado.puntos1/puntos2 += 1` según `estado.turno`, dispara `sonidos.tocar('punto')`, flota corazoncitos hacia el nombre ganador, pop en el marcador; siempre → `sonidos.tocar('flip')`, animación `salirCarta` y a los ~250ms `repartirCarta()`. Alterna `estado.turno` (1↔2). Guarda estado.
- Cronómetro: `let timerId = null;` arranca con `estado.config.tiempo`. Cada segundo: decrementa, renderiza `formatTiempo` en `#anillo-tiempo`, actualiza `stroke-dasharray` del anillo (`fraccionAnillo`), si `esTension(restante)` añade clase `.tension` al anillo y `sonidos.tocar('tic')`. Al llegar a 0: `clearInterval`, añade `.tension`, `sonidos.tocar('timeout')`, **congela** (no resuelve solo; el jugador decide).
- `finalizarPartida()`: `clearInterval`, `estado.enPartida=false`, guarda, `mostrarFin()`.
- `window.iniciarPartida = iniciarPartida; window.resolverCarta = resolverCarta; window.finalizarPartida = finalizarPartida;`

- [ ] **Step 2: Añadir CSS de animaciones si faltan en `css/styles.css`**

Asegurar keyframes `entrarCarta` (from: opacity 0, scale .9, rotate -3deg; to: opacity 1, scale 1, rotate 0), `salirCarta`, `shake` (vibración visual de la carta al resolver: 2-3 traslaciones cortas), `pop` (marcador), `flotarCorazon` (opacity+translateY hacia arriba), `latir` (anillo en tensión: scale 1↔1.06). Clase `.turno-activo` con glow frambuesa. Corazones: elementos `<span class="corazon">♥</span>` clonados dentro de `#carta` o flotando, con `animation: flotarCorazon 1s ease-out forwards`.

- [ ] **Step 3: Verificación en navegador**

Jugar una partida completa: iniciar, ver carta animada, pulsar Hecho (punto+corazones+sonido), No hecho (sin punto), turno alterna, cronómetro baja, con 10s el anillo late en rojo con tic, al llegar a 0 se congela, finalizar → pantalla fin.
Expected: todas las interacciones funcionan; sin errores de consola.

- [ ] **Step 4: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "feat: pantalla de partida con turnos, puntos y cronometro"
```

---

### Task 9: Fin de partida, desempate y confeti

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `mostrarPantalla`, `renderMarcador`, `repartirCarta` (Task 8); pantalla fin (Task 6).
- Produces: `window.mostrarFin()`, `window.rondaExtra()`, `window.reiniciar()`, `window.volverConfig()`. Confeti como función interna `lanzarConfeti()`.

- [ ] **Step 1: Implementar fin de partida en `js/app.js`**

- `mostrarFin()`: `mostrarPantalla('fin')`, render marcador final en `#fin-marcador`, determina ganador:
  - puntos distintos → mostrar ganador, `lanzarConfeti()`, `sonidos.tocar('fin')`.
  - empate → mostrar "¡Empate!" + botón `rondaExtra`.
- `lanzarConfeti()`: genera 40-60 partículas `<span class="confeti">` con colores de paleta, posiciones random, `animation: confeti <dur> ease-out forwards`, se eliminan del DOM al terminar.
- `rondaExtra()`: `mostrarPantalla('partida')`, `estado.turno` se mantiene alternado, resetea puntos a 0 para la ronda extra? No — spec: "el primer punto decide". Se muestra un banner `#banner-extra` "Ronda extra · el primer punto gana". Tras el primer `resolverCarta(hecho)`, se llama `finalizarPartida()` de inmediato. Implementar con `let enRondaExtra = false;` y en `resolverCarta` verificar: si `enRondaExtra && hecho` → tras sumar, `finalizarPartida()`.
- `reiniciar()`: conserva config y nombres, `estado.puntos1=puntos2=0`, `estado.enPartida=true`, `mostrarPantalla('partida')`, `iniciarPartida()`.
- `volverConfig()`: `mostrarPantalla('asistente')` con paso 1.

- [ ] **Step 2: CSS de confeti y banner**

`@keyframes confeti` (translateY caída + rotación), `.confeti` (pos absolute, 8×12px, colores var(--frambuesa/--rosa/--lavanda/--dorado)). `.banner-extra` (pastilla centrada frambuesa, texto blanco). Botones `#btn-ronda-extra`, `#btn-reiniciar`, `#btn-volver-config` con estilos primario/secundario.

- [ ] **Step 3: Verificación en navegador**

- Partida con puntos distintos → pantalla ganador con confeti y sonido.
- Partida con empate → pantalla "¡Empate!", botón ronda extra, primer Hecho decide y muestra ganador.
- "Jugar de nuevo" reinicia con misma config; "Configurar otra partida" vuelve al asistente.

- [ ] **Step 4: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "feat: fin de partida, desempate a ronda extra y confeti"
```

---

### Task 10: Editor "Mis cartas" (CRUD + exportar/importar)

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`
- Modify: `index.html` (contenido de pantalla-miscartas si falta)

**Interfaces:**
- Consumes: `cargarEstado`/`guardarEstado`; pantalla `pantalla-miscartas` (Task 6).
- Produces: `window.abrirMiscartas()`, `window.guardarCarta()` (crear/editar), `window.editarCarta(id)`, `window.borrarCarta(id)`, `window.exportarJSON()`, `window.importarJSON(input)`. Persistencia de cartas de usuario en `cp.misCartas`.

- [ ] **Step 1: Implementar el CRUD de cartas de usuario**

- Al iniciar, cargar `cp.misCartas` (array) y mezclarlo en la partida junto a `cartasUsuario` del hosting. (Modificar `mergeCards` call en Task 8 para incluir `estado.misCartas`.)
- `renderMiscartas()`: lista de cartas con categoría, texto, botones editar (✏️) y borrar (🗑).
- `agregarCarta()`: formulario con `<select>` de categorías y `<textarea>` de texto; guarda `{id, categoria, texto}` con id incremental (max+1).
- `editarCarta(id)`: precarga el formulario.
- `guardarCarta()`: valida texto no vacío; crea o actualiza; persiste `cp.misCartas`; re-render.
- `borrarCarta(id)`: confirma y elimina.
- `exportarJSON()`: genera Blob con `{categorias, cartas: estado.misCartas}` y descarga `cartas-usuario.json` vía `URL.createObjectURL`.
- `importarJSON(input)`: lee el archivo (FileReader), valida estructura mínima (`categorias` array y `cartas` array), re-numera ids, mezcla con las existentes, persiste, re-render.
- Exponer todas en `window`.

- [ ] **Step 2: Verificación en navegador**

- Crear/editar/borrar cartas → aparecen en la partida.
- Exportar → descarga `cartas-usuario.json` con formato correcto.
- Importar un JSON válido → se agregan; importar uno inválido → mensaje de error amable.
- Recargar → las cartas persisten (localStorage).

- [ ] **Step 3: Commit**

```bash
git add js/app.js css/styles.css index.html
git commit -m "feat: editor de cartas del usuario con exportar/importar"
```

---

### Task 11: PWA — manifest, service worker, iconos y README

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `icons/icon.svg`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Create: `README.md`

**Interfaces:**
- Consumes: lista de assets del proyecto.
- Produces: PWA instalable; `README.md` con instrucciones para el cliente (cómo editar cartas.json, agregar sus cartas, exportar/importar, cómo instalar la app).

- [ ] **Step 1: Escribir `manifest.webmanifest`**

```json
{
  "name": "Cartas Parejas",
  "short_name": "CartasParejas",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#140e14",
  "theme_color": "#6b2540",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Escribir `sw.js`**

```js
const CACHE = 'cartas-parejas-v1';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/cards.js', './js/sound.js', './js/timer.js',
  './data/cartas.json', './data/cartas-usuario.json',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const clone = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
```

- [ ] **Step 3: Registrar el SW en `js/app.js`**

Al final del módulo:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
```

- [ ] **Step 4: Crear iconos**

Crear `icons/icon.svg`: corazón blanco/rosa sobre fondo vino (`#6b2540`), esquinas redondeadas. Generar `icon-192.png` y `icon-512.png` desde el SVG (convertir con `rsvg-convert` o `magick` si están disponibles; si no, dejar el SVG y añadir `"type":"image/svg+xml"` al manifest para el icono SVG además de los PNG — pero PWA en Android/Chrome requiere PNG 192+512 para instalar; generar los PNG es obligatorio).

```bash
# Si rsvg-convert existe:
rsvg-convert -w 192 -h 192 icons/icon.svg -o icons/icon-192.png
rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png
# Si magick (ImageMagick) existe:
magick icons/icon.svg -resize 192x192 icons/icon-192.png
magick icons/icon.svg -resize 512x512 icons/icon-512.png
# Si ninguno, instalar librsvg o usar el SVG en el manifest
```

- [ ] **Step 5: Escribir `README.md`**

Sección para el cliente (no programador), en español:
- Cómo subir el proyecto al hosting estático.
- Cómo editar `data/cartas.json` (qué campo cambiar, cómo agregar cartas copiando una línea, cómo agregar categoría a `categorias`).
- Cómo crear sus propias cartas desde la app (pantalla "Mis cartas") y exportarlas.
- Cómo instalar la app en Android (Chrome → instalar) e iOS (compartir → añadir a pantalla de inicio).
- Cómo funciona el modo offline.

- [ ] **Step 6: Verificar instalación PWA y offline**

Con `http.server` activo y la pestaña del navegador en localhost: primero cargar (registra SW), recargar, luego desactivar red (DevTools → Network → Offline) y recargar → la app debe cargar completa offline. Verificar en Lighthouse (opcional) instalabilidad.
Expected: funciona offline tras primera carga; manifest válido.

- [ ] **Step 7: Commit**

```bash
git add manifest.webmanifest sw.js icons/ README.md js/app.js
git commit -m "feat: PWA instalable con service worker e instrucciones"
```

---

### Task 12: Pulido final y verificación integral

**Files:**
- Modify: cualquier archivo según resultados.

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Revisar y pulir detalles**

- Safe-area padding en `.pantalla` (`padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px)`).
- `-webkit-tap-highlight-color: transparent` y `user-select:none` en body.
- Estados de botones activos (`:active { transform: scale(.97) }`).
- Botón de silencio: icono cambia 🔇/🔊 y persiste `cp.sonido`.
- Verificar que no se repite la carta inmediatamente anterior al re-barajar.
- Texto de cartas revisado: sin erratas, apropiado para parejas.

- [ ] **Step 2: Ejecutar todos los tests**

Run: `npm test`
Expected: PASS completo (cards, data, timer, sound, estado).

- [ ] **Step 3: Prueba manual integral**

Recorrer el flujo completo en navegador (modo dispositivo móvil): inicio → asistente → partida (Hecho/No hecho, cronómetro, silencio, finalizar) → fin/desempate → mis cartas (CRUD/exportar/importar) → reinstalar y recargar offline.
Expected: sin errores de consola en ningún paso; comportamiento según spec.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: pulido final y verificacion"
```

---

## Self-Review

**Spec coverage:**
- Paleta/diseño Vino & Rosa → Task 6 (CSS) + spec constraints. ✓
- Carta degradado vino → Task 6. ✓
- Cronómetro anillo circular + tensión roja → Task 4 (helpers) + Task 8 (render/latido). ✓
- Marcador superior fijo → Task 6 (HTML) + Task 8 (render). ✓
- Asistente por pasos → Task 7. ✓
- Fin de partida + ronda extra → Task 9. ✓
- Micro-interacciones (corazones, shake, sonido, tics, confeti) → Tasks 5, 8, 9. ✓
- Editor de cartas con exportar/importar → Task 10. ✓
- JSON base 250+ cartas + usuario → Task 3. ✓
- PWA/offline/manifest/SW → Task 11. ✓
- Persistencia localStorage → Task 7. ✓
- Sin exportación imprimible → no incluida (descartada en alcance). ✓

**Placeholder scan:** Ningún "TBD/TODO". Todos los pasos tienen código o instrucciones concretas. Las cartas en Task 3 son contenido que el implementador redacta según tonos de ejemplo; se especifica cantidad exacta y validación por test.

**Type consistency:** `mergeCards(base.cartas, usuario.cartas)` recibe arrays (Task 2 test) — en Task 8 se llama con arrays de cartas. `robarCarta(deck, prevId)` retorna `{carta, deck}` usado en Task 8. `Sonidos.tocar(nombre)` nombres consistentes ('punto','flip','tic','timeout','fin') en Task 5 y Task 8. `formatTiempo/fraccionAnillo/esTension` firmas consistentes Task 4 → Task 8. `estadoInicial/guardarEstado/cargarEstado` Task 7 → usado en Task 7/8. ✓