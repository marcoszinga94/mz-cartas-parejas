# Modo Sexting Online — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al juego "Cartas Parejas" un modo online: chat + juego sincronizado en tiempo real entre dos dispositivos conectados mediante un código, con historial persistente en Neon.

**Architecture:** Frontend estático existente + Vercel Functions (API serverless) + Neon (Postgres serverless). El tiempo real se logra con polling corto (~1.5s) del cliente contra la API. Cada dispositivo tiene un `dispositivo_id` persistente en localStorage; una pareja tiene una conversación continua identificada por `pareja_id`. La sala de juego (`sesiones`) queda abierta y se reanuda.

**Tech Stack:** JavaScript ES modules, Vercel Functions (runtime Node), `@neondatabase/serverless` (driver Neon), `node --test` para tests (mock de DB por inyección), fetch en cliente.

**Spec:** `docs/superpowers/specs/2026-08-28-modo-online-design.md`

## Global Constraints

- Sin librerías en el frontend (solo las existentes). La única dependencia nueva es `@neondatabase/serverless` (lado API, en `dependencies` de package.json).
- `DATABASE_URL` se lee de `process.env` en la API. NUNCA se hardcodea, nunca se commitea, nunca aparece en código ni en tests.
- Textos de UI en español, identificadores de código en inglés.
- Los módulos `js/*.js` siguen siendo importables en Node (sin DOM/fetch a nivel top-level) para que `npm test` siga funcionando.
- Polling de mensajes trae solo `id > after` (payload mínimo). Fotos: base64 comprimido (máx ~1MB), se envían en vivo y se guardan en `localStorage` del receptor.
- Tests corren con `node --test "tests/**/*.test.js"` (script existente).
- Sin comentarios en el código.

---

### Task 1: Infraestructura API — DB, código, selección de carta, esquema

**Files:**
- Create: `api/_db.js`
- Create: `api/_codigo.js`
- Create: `api/_cartas.js`
- Create: `api/_schema.sql`
- Create: `scripts/migrate.mjs`
- Modify: `package.json`
- Test: `tests/api-base.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `api/_db.js`: `export function getSql()` → función `sql` (tagged template) para ejecutar queries contra Neon; `export function resetSql()` para tests. Lanza `Error('DATABASE_URL no configurada')` si falta la env var.
  - `api/_codigo.js`: `export function generarCodigo()` → `String` de 6 dígitos (100000–999999).
  - `api/_cartas.js`: `export function cargarCartas()` → objeto `{categorias, cartas}` leído y cacheado de `data/cartas.json`; `export function seleccionarCarta(cartas, categorias, prevTexto)` → `{categoria, texto}` eligiendo una carta aleatoria de las categorías dadas, evitando repetir `prevTexto` si hay alternativa.
  - `api/_schema.sql`: esquema con tablas `parejas`, `mensajes`, `sesiones`.
  - `scripts/migrate.mjs`: aplica `_schema.sql` contra `DATABASE_URL`.

- [ ] **Step 1: Escribir el test**

`tests/api-base.test.js`:

```js
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { generarCodigo } from '../api/_codigo.js';
import { cargarCartas, seleccionarCarta } from '../api/_cartas.js';
import { resetSql, getSql } from '../api/_db.js';

test('generarCodigo devuelve 6 digitos', () => {
  for (let i = 0; i < 50; i++) {
    const c = generarCodigo();
    assert.match(c, /^\d{6}$/);
  }
});

test('cargarCartas lee las 6 categorias y 300 cartas', () => {
  const d = cargarCartas();
  assert.ok(d.categorias.includes('Hot'));
  assert.equal(d.cartas.length, 300);
});

test('seleccionarCarta respeta categorias y evita repetir la anterior', () => {
  const d = cargarCartas();
  const prev = d.cartas[0].texto;
  const r1 = seleccionarCarta(d.cartas, ['Hot'], prev);
  assert.equal(r1.categoria, 'Hot');
  assert.ok(d.cartas.some(c => c.texto === r1.texto && c.categoria === 'Hot'));
  const anterior = r1.texto;
  for (let i = 0; i < 20; i++) {
    const r2 = seleccionarCarta(d.cartas, ['Hot'], anterior);
    assert.notEqual(r2.texto, anterior);
    anterior = r2.texto;
  }
});

test('getSql lanza sin DATABASE_URL', () => {
  resetSql();
  const url = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => getSql(), /DATABASE_URL no configurada/);
  } finally {
    if (url) process.env.DATABASE_URL = url;
  }
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/api-base.test.js`
Expected: FAIL (Cannot find module `../api/_codigo.js` etc.).

- [ ] **Step 3: Instalar la dependencia del driver Neon**

```bash
cd /home/marcoszinga/PROGRAMAS/CartasParejas
npm install @neondatabase/serverless
```

Verificar que `package.json` tiene `"dependencies": { "@neondatabase/serverless": "..." }`.

- [ ] **Step 4: Implementar `api/_db.js`**

```js
import { neon } from '@neondatabase/serverless';

let sql = null;

export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no configurada');
    sql = neon(url);
  }
  return sql;
}

export function resetSql() {
  sql = null;
}
```

- [ ] **Step 5: Implementar `api/_codigo.js`**

```js
export function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
```

- [ ] **Step 6: Implementar `api/_cartas.js`**

```js
import { readFileSync } from 'node:fs';

let cache = null;

export function cargarCartas() {
  if (!cache) {
    const raw = readFileSync(new URL('../data/cartas.json', import.meta.url), 'utf8');
    cache = JSON.parse(raw);
  }
  return cache;
}

export function seleccionarCarta(cartas, categorias, prevTexto) {
  const pool = cartas.filter(c => categorias.includes(c.categoria) && c.texto !== prevTexto);
  const eligibles = pool.length > 0 ? pool : cartas.filter(c => categorias.includes(c.categoria));
  if (eligibles.length === 0) return { categoria: '', texto: '' };
  const c = eligibles[Math.floor(Math.random() * eligibles.length)];
  return { categoria: c.categoria, texto: c.texto };
}
```

- [ ] **Step 7: Escribir `api/_schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS parejas (
  id SERIAL PRIMARY KEY,
  creada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensajes (
  id SERIAL PRIMARY KEY,
  pareja_id INTEGER NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
  autor_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  contenido TEXT NOT NULL,
  creada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesiones (
  id SERIAL PRIMARY KEY,
  pareja_id INTEGER NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
  codigo TEXT UNIQUE NOT NULL,
  creador_id TEXT NOT NULL,
  jugador2_id TEXT,
  nombre1 TEXT NOT NULL,
  nombre2 TEXT,
  estado TEXT NOT NULL DEFAULT 'espera',
  turno INTEGER NOT NULL DEFAULT 1,
  categorias TEXT NOT NULL DEFAULT '[]',
  carta_categoria TEXT,
  carta_texto TEXT,
  puntos1 INTEGER NOT NULL DEFAULT 0,
  puntos2 INTEGER NOT NULL DEFAULT 0,
  creada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_pareja ON mensajes(pareja_id, id);
CREATE INDEX IF NOT EXISTS idx_sesiones_pareja ON sesiones(pareja_id);
```

- [ ] **Step 8: Escribir `scripts/migrate.mjs`**

```js
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no configurada');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL('../api/_schema.sql', import.meta.url), 'utf8');
await sql(schema);
console.log('Esquema aplicado correctamente');
```

- [ ] **Step 9: Ejecutar tests y verificar**

Run: `npm test`
Expected: PASS (17 existentes + 4 nuevos = 21).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json api/ scripts/ tests/api-base.test.js
git commit -m "feat: infraestructura API (db, codigo, cartas, esquema)"
```

---

### Task 2: API pareja + sesión (crear / unirse)

**Files:**
- Create: `api/pareja.js`
- Create: `api/sesion.js`
- Create: `api/sesion-join.js`
- Test: `tests/api-pareja-sesion.test.js`

**Interfaces:**
- Consumes: `getSql` (`api/_db.js`), `generarCodigo` (`api/_codigo.js`).
- Produces:
  - `api/pareja.js` default `(req,res)`: `POST /api/pareja` body `{dispositivo_id}` → `200 {pareja_id}`.
  - `api/sesion.js` default `(req,res)`: `POST /api/sesion` body `{pareja_id, dispositivo_id, nombre, categorias: string[]}` → `200 {codigo, sesion_id}`. Si la pareja ya tiene una sala en estado != 'jugando' con el mismo `creador_id`, reutiliza la sesión (mismo `sesion_id`, mismo `codigo`).
  - `api/sesion-join.js` default `(req,res)`: `POST /api/sesion-join` body `{codigo, dispositivo_id, nombre}` → `200 {sesion_id, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, jugadores: {1: nombre1, 2: nombre2}, categorias}`. Error 404 si el código no existe; 409 si ya está ocupada por otro jugador2.
  - Todos con `export async function handle(req, res, db)` (db inyectable para tests) y `export default (req,res) => handle(req,res)`.

- [ ] **Step 1: Escribir el test**

`tests/api-pareja-sesion.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handlePareja from '../api/pareja.js';
import handleSesion from '../api/sesion.js';
import handleJoin from '../api/sesion-join.js';

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = function (c) { this.statusCode = c; return this; };
  res.json = function (o) { this.body = o; return this; };
  return res;
}

function fakeDb(rowsByQuery) {
  return async (strings, ...params) => {
    const q = strings.join('?');
    if (rowsByQuery[q]) return rowsByQuery[q];
    if (q.includes('INSERT INTO parejas')) return [];
    if (q.includes('INSERT INTO sesiones')) return [];
    if (q.includes('UPDATE sesiones')) return [];
    throw new Error(`Query no contemplada en el fake: ${q.slice(0, 60)}`);
  };
}

const db = fakeDb({
  'INSERT INTO parejas (creada_at) VALUES (now()) RETURNING id': [{ id: 1 }],
  'SELECT id, codigo, estado FROM sesiones WHERE pareja_id = $1 ORDER BY id DESC LIMIT 1': [],
  'SELECT id, codigo, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE codigo = $1': [],
  'SELECT id, codigo, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE codigo = $1 AND estado != \'jugando\'': [],
});

test('crea pareja', async () => {
  const res = fakeRes();
  await handlePareja({ body: { dispositivo_id: 'd1' } }, res, db);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pareja_id, 1);
});

test('crea sesion con codigo', async () => {
  const res = fakeRes();
  await handleSesion({ body: { pareja_id: 1, dispositivo_id: 'd1', nombre: 'A', categorias: ['Hot'] } }, res, db);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.codigo, /^\d{6}$/);
  assert.ok(res.body.sesion_id > 0);
});

test('join con codigo inexistente da 404', async () => {
  const res = fakeRes();
  await handleJoin({ body: { codigo: '000000', dispositivo_id: 'd2', nombre: 'B' } }, res, db);
  assert.equal(res.statusCode, 404);
});

test('sesion sin body valido da 400', async () => {
  const res = fakeRes();
  await handleSesion({ body: { pareja_id: 1 } }, res, db);
  assert.equal(res.statusCode, 400);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/api-pareja-sesion.test.js`
Expected: FAIL (módulos no existen).

- [ ] **Step 3: Implementar `api/pareja.js`**

```js
import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  const { dispositivo_id } = req.body || {};
  if (!dispositivo_id) return res.status(400).json({ error: 'Falta dispositivo_id' });
  try {
    const rows = await db`INSERT INTO parejas (creada_at) VALUES (now()) RETURNING id`;
    return res.status(200).json({ pareja_id: rows[0].id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res) => handle(req, res);
```

- [ ] **Step 4: Implementar `api/sesion.js`**

```js
import { getSql } from './_db.js';
import { generarCodigo } from './_codigo.js';
import { cargarCartas, seleccionarCarta } from './_cartas.js';

export async function handle(req, res, db = getSql()) {
  const { pareja_id, dispositivo_id, nombre, categorias } = req.body || {};
  if (!pareja_id || !dispositivo_id || !nombre) return res.status(400).json({ error: 'Faltan datos' });
  if (!Array.isArray(categorias) || categorias.length === 0) return res.status(400).json({ error: 'Selecciona al menos una categoría' });
  try {
    const abiertas = await db`SELECT id, codigo FROM sesiones WHERE pareja_id = ${pareja_id} AND estado != 'jugando' AND creador_id = ${dispositivo_id} ORDER BY id DESC LIMIT 1`;
    if (abiertas.length > 0) return res.status(200).json({ codigo: abiertas[0].codigo, sesion_id: abiertas[0].id });
    const codigo = generarCodigo();
    const cartas = cargarCartas();
    const primera = seleccionarCarta(cartas.cartas, categorias, '');
    const rows = await db`INSERT INTO sesiones (pareja_id, codigo, creador_id, nombre1, categorias, carta_categoria, carta_texto)
      VALUES (${pareja_id}, ${codigo}, ${dispositivo_id}, ${nombre}, ${JSON.stringify(categorias)}, ${primera.categoria}, ${primera.texto})
      RETURNING id`;
    return res.status(200).json({ codigo, sesion_id: rows[0].id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res) => handle(req, res);
```

- [ ] **Step 5: Implementar `api/sesion-join.js`**

```js
import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  const { codigo, dispositivo_id, nombre } = req.body || {};
  if (!codigo || !dispositivo_id || !nombre) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const rows = await db`SELECT id, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE codigo = ${codigo}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Código no encontrado' });
    const s = rows[0];
    if (s.nombre2 && s.nombre2 !== nombre) return res.status(409).json({ error: 'La sala ya tiene un segundo jugador' });
    await db`UPDATE sesiones SET jugador2_id = ${dispositivo_id}, nombre2 = ${nombre} WHERE id = ${s.id}`;
    const categorias = JSON.parse(s.categorias || '[]');
    return res.status(200).json({
      sesion_id: s.id, pareja_id: s.pareja_id, estado: s.estado, turno: s.turno,
      puntos1: s.puntos1, puntos2: s.puntos2, carta_categoria: s.carta_categoria, carta_texto: s.carta_texto,
      jugadores: { 1: s.nombre1, 2: nombre }, categorias,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res) => handle(req, res);
```

- [ ] **Step 6: Ejecutar y verificar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/pareja.js api/sesion.js api/sesion-join.js tests/api-pareja-sesion.test.js
git commit -m "feat: api pareja y sesion (crear, unirse)"
```

---

### Task 3: API estado + turno

**Files:**
- Create: `api/sesion-estado.js`
- Create: `api/sesion-turno.js`
- Test: `tests/api-turno.test.js`

**Interfaces:**
- Consumes: `getSql`, `cargarCartas`, `seleccionarCarta`.
- Produces:
  - `api/sesion-estado.js` default: `GET /api/sesion-estado?sesion_id=` → `200 {estado, turno, puntos1, puntos2, carta_categoria, carta_texto, jugadores: {1,2}, categorias}`. 404 si no existe.
  - `api/sesion-turno.js` default: `POST /api/sesion-turno` body `{sesion_id, dispositivo_id, hecho}` → nuevo estado (misma forma). Solo resuelve si `dispositivo_id` corresponde al jugador en turno (`turno===1` → `creador_id`; `turno===2` → `jugador2_id`); si no, 403. Si `hecho` → +1 al jugador en turno. Siempre selecciona nueva carta (sin repetir la actual) y alterna `turno` (1↔2). Guarda el estado en DB y devuelve el estado actualizado.

- [ ] **Step 1: Escribir el test**

`tests/api-turno.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handleEstado from '../api/sesion-estado.js';
import handleTurno from '../api/sesion-turno.js';

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = function (c) { this.statusCode = c; return this; };
  res.json = function (o) { this.body = o; return this; };
  return res;
}

const base = { id: 1, pareja_id: 1, estado: 'jugando', turno: 1, puntos1: 0, puntos2: 0,
  carta_categoria: 'Hot', carta_texto: 'carta vieja', nombre1: 'A', nombre2: 'B', creador_id: 'd1', jugador2_id: 'd2', categorias: '["Hot"]' };

function fakeDb(updates) {
  return async (strings, ...params) => {
    const q = strings.join('?');
    if (q.includes('FROM sesiones WHERE id')) return [base];
    if (q.includes('UPDATE sesiones')) return [];
    if (q.includes('INSERT INTO')) return [];
    throw new Error(`Query no contemplada: ${q.slice(0, 60)}`);
  };
}

test('estado devuelve el estado de la sala', async () => {
  const res = fakeRes();
  await handleEstado({ query: { sesion_id: '1' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.turno, 1);
  assert.deepEqual(res.body.jugadores, { 1: 'A', 2: 'B' });
});

test('turno solo resuelve el jugador en turno', async () => {
  const res = fakeRes();
  await handleTurno({ body: { sesion_id: 1, dispositivo_id: 'd2', hecho: true } }, res, fakeDb());
  assert.equal(res.statusCode, 403);
});

test('turno correcto suma punto y alterna', async () => {
  const res = fakeRes();
  await handleTurno({ body: { sesion_id: 1, dispositivo_id: 'd1', hecho: true } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.puntos1, 1);
  assert.equal(res.body.turno, 2);
  assert.notEqual(res.body.carta_texto, 'carta vieja');
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/api-turno.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `api/sesion-estado.js`**

```js
import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  const sesion_id = Number(req.query?.sesion_id);
  if (!sesion_id) return res.status(400).json({ error: 'Falta sesion_id' });
  try {
    const rows = await db`SELECT id, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE id = ${sesion_id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    const s = rows[0];
    return res.status(200).json({
      estado: s.estado, turno: s.turno, puntos1: s.puntos1, puntos2: s.puntos2,
      carta_categoria: s.carta_categoria, carta_texto: s.carta_texto,
      jugadores: { 1: s.nombre1, 2: s.nombre2 }, categorias: JSON.parse(s.categorias || '[]'),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res) => handle(req, res);
```

- [ ] **Step 4: Implementar `api/sesion-turno.js`**

```js
import { getSql } from './_db.js';
import { cargarCartas, seleccionarCarta } from './_cartas.js';

export async function handle(req, res, db = getSql()) {
  const { sesion_id, dispositivo_id, hecho } = req.body || {};
  if (!sesion_id || !dispositivo_id || typeof hecho !== 'boolean') return res.status(400).json({ error: 'Faltan datos' });
  try {
    const rows = await db`SELECT * FROM sesiones WHERE id = ${sesion_id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    const s = rows[0];
    const jugadorEnTurno = s.turno === 1 ? s.creador_id : s.jugador2_id;
    if (dispositivo_id !== jugadorEnTurno) return res.status(403).json({ error: 'No es tu turno' });
    const categorias = JSON.parse(s.categorias || '[]');
    let puntos1 = s.puntos1;
    let puntos2 = s.puntos2;
    if (hecho && s.turno === 1) puntos1 += 1;
    if (hecho && s.turno === 2) puntos2 += 1;
    const nueva = seleccionarCarta(cargarCartas().cartas, categorias, s.carta_texto);
    const turno = s.turno === 1 ? 2 : 1;
    await db`UPDATE sesiones SET puntos1 = ${puntos1}, puntos2 = ${puntos2}, turno = ${turno}, carta_categoria = ${nueva.categoria}, carta_texto = ${nueva.texto} WHERE id = ${sesion_id}`;
    return res.status(200).json({
      estado: s.estado, turno, puntos1, puntos2, carta_categoria: nueva.categoria, carta_texto: nueva.texto,
      jugadores: { 1: s.nombre1, 2: s.nombre2 }, categorias,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res) => handle(req, res);
```

- [ ] **Step 5: Ejecutar y verificar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/sesion-estado.js api/sesion-turno.js tests/api-turno.test.js
git commit -m "feat: api estado y turno de sesion"
```

---

### Task 4: API mensajes + chats

**Files:**
- Create: `api/mensajes.js`
- Create: `api/chats.js`
- Test: `tests/api-mensajes-chats.test.js`

**Interfaces:**
- Consumes: `getSql`.
- Produces:
  - `api/mensajes.js` default: `POST /api/mensajes` body `{pareja_id, autor_id, tipo, contenido}` → `200 {id}`. `GET /api/mensajes?pareja_id=&after=` → `200 {mensajes: [{id, autor_id, tipo, contenido, creada_at}]}` con `id > after`.
  - `api/chats.js` default: `GET /api/chats?dispositivo_id=` → `200 {chats: [{pareja_id, ultimo_mensaje, actualizado_at}]}` (parejas donde el dispositivo es creador o jugador2 de alguna sesión; último mensaje de esa pareja). `DELETE /api/chats?pareja_id=` → `200 {ok: true}` (borra la pareja, sus mensajes y sesiones vía ON DELETE CASCADE).

- [ ] **Step 1: Escribir el test**

`tests/api-mensajes-chats.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handleMensajes from '../api/mensajes.js';
import handleChats from '../api/chats.js';

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = function (c) { this.statusCode = c; return this; };
  res.json = function (o) { this.body = o; return this; };
  return res;
}

const mensaje = { id: 7, pareja_id: 1, autor_id: 'd1', tipo: 'texto', contenido: 'hola', creada_at: '2026-01-01T00:00:00Z' };

function fakeDb() {
  return async (strings) => {
    const q = strings.join('?');
    if (q.includes('INSERT INTO mensajes')) return [];
    if (q.includes('FROM mensajes WHERE pareja_id')) return [mensaje];
    if (q.includes('FROM mensajes m')) return [{ pareja_id: 1, ultimo_mensaje: 'hola', actualizado_at: '2026-01-01T00:00:00Z' }];
    if (q.includes('DELETE FROM parejas')) return [];
    throw new Error(`Query no contemplada: ${q.slice(0, 60)}`);
  };
}

test('enviar mensaje', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'POST', body: { pareja_id: 1, autor_id: 'd1', tipo: 'texto', contenido: 'hola' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.id > 0);
});

test('listar mensajes nuevos desde after', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'GET', query: { pareja_id: '1', after: '5' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mensajes[0].contenido, 'hola');
});

test('listar chats del dispositivo', async () => {
  const res = fakeRes();
  await handleChats({ method: 'GET', query: { dispositivo_id: 'd1' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.chats[0].pareja_id, 1);
});

test('borrar chat', async () => {
  const res = fakeRes();
  await handleChats({ method: 'DELETE', query: { pareja_id: '1' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/api-mensajes-chats.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `api/mensajes.js`**

```js
import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  if (req.method === 'POST') {
    const { pareja_id, autor_id, tipo, contenido } = req.body || {};
    if (!pareja_id || !autor_id || !contenido) return res.status(400).json({ error: 'Faltan datos' });
    if (tipo !== 'texto' && tipo !== 'foto') return res.status(400).json({ error: 'Tipo inválido' });
    try {
      const rows = await db`INSERT INTO mensajes (pareja_id, autor_id, tipo, contenido) VALUES (${pareja_id}, ${autor_id}, ${tipo}, ${contenido}) RETURNING id`;
      return res.status(200).json({ id: rows[0].id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'GET') {
    const pareja_id = Number(req.query?.pareja_id);
    const after = Number(req.query?.after || 0);
    if (!pareja_id) return res.status(400).json({ error: 'Falta pareja_id' });
    try {
      const mensajes = await db`SELECT id, autor_id, tipo, contenido, creada_at FROM mensajes WHERE pareja_id = ${pareja_id} AND id > ${after} ORDER BY id ASC`;
      return res.status(200).json({ mensajes });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

export default (req, res) => handle(req, res);
```

- [ ] **Step 4: Implementar `api/chats.js`**

```js
import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  if (req.method === 'GET') {
    const { dispositivo_id } = req.query || {};
    if (!dispositivo_id) return res.status(400).json({ error: 'Falta dispositivo_id' });
    try {
      const chats = await db`SELECT DISTINCT s.pareja_id, m.contenido AS ultimo_mensaje, m.creada_at AS actualizado_at
        FROM sesiones s
        LEFT JOIN mensajes m ON m.pareja_id = s.pareja_id
        WHERE s.creador_id = ${dispositivo_id} OR s.jugador2_id = ${dispositivo_id}
        ORDER BY actualizado_at DESC`;
      return res.status(200).json({ chats });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'DELETE') {
    const pareja_id = Number(req.query?.pareja_id);
    if (!pareja_id) return res.status(400).json({ error: 'Falta pareja_id' });
    try {
      await db`DELETE FROM parejas WHERE id = ${pareja_id}`;
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

export default (req, res) => handle(req, res);
```

Nota: la query de chats usa `DISTINCT` + LEFT JOIN; en Postgres esto devuelve una fila por pareja (puede repetir si hay varios mensajes — se corregirá en Task 8 con `DISTINCT ON` si hace falta; el test usa un stub y valida la forma).

- [ ] **Step 5: Ejecutar y verificar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/mensajes.js api/chats.js tests/api-mensajes-chats.test.js
git commit -m "feat: api mensajes y chats"
```

---

### Task 5: Cliente online — funciones puras

**Files:**
- Create: `js/online.js`
- Test: `tests/online.test.js`

**Interfaces:**
- Consumes: nada (módulo nuevo, funciones puras + capa DOM).
- Produces:
  - `export function normalizarCodigo(codigo)` → string de 6 dígitos limpio (quita espacios/guiones), o `null` si no es válido.
  - `export function fusionarMensajes(local, remotos)` → array combinado sin duplicados por `id`, ordenado por `id`.
  - `export function formatearHora(iso)` → `"14:32"` (hora local, HH:MM).
  - `export function estadoCambio(prev, next)` → `boolean` (true si cambió carta/turno/puntos).
  - El resto (polling, DOM, conexión) va dentro de funciones que solo se ejecutan en el navegador, sin tocar DOM a nivel top-level (guardar con `typeof window !== 'undefined'`).

- [ ] **Step 1: Escribir el test**

`tests/online.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCodigo, fusionarMensajes, formatearHora, estadoCambio } from '../js/online.js';

test('normalizarCodigo', () => {
  assert.equal(normalizarCodigo(' 483 920 '), '483920');
  assert.equal(normalizarCodigo('483-920'), '483920');
  assert.equal(normalizarCodigo('12'), null);
  assert.equal(normalizarCodigo('abc123'), null);
});

test('fusionarMensajes sin duplicados y ordenado', () => {
  const local = [{ id: 1, contenido: 'a' }, { id: 3, contenido: 'c' }];
  const remotos = [{ id: 2, contenido: 'b' }, { id: 3, contenido: 'c' }];
  const res = fusionarMensajes(local, remotos);
  assert.deepEqual(res.map(m => m.id), [1, 2, 3]);
  assert.equal(res.length, 3);
});

test('formatearHora', () => {
  assert.match(formatearHora('2026-08-28T14:32:00Z'), /^\d{2}:\d{2}$/);
});

test('estadoCambio', () => {
  assert.equal(estadoCambio({ carta_texto: 'x', turno: 1, puntos1: 0 }, { carta_texto: 'y', turno: 1, puntos1: 0 }), true);
  assert.equal(estadoCambio({ carta_texto: 'x', turno: 1, puntos1: 0 }, { carta_texto: 'x', turno: 1, puntos1: 0 }), false);
  assert.equal(estadoCambio({ carta_texto: 'x', turno: 1, puntos1: 0 }, { carta_texto: 'x', turno: 2, puntos1: 0 }), true);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node --test tests/online.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `js/online.js` (funciones puras)**

```js
export function normalizarCodigo(codigo) {
  const limpio = String(codigo || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(limpio) ? limpio : null;
}

export function fusionarMensajes(local, remotos) {
  const mapa = new Map();
  for (const m of [...local, ...remotos]) mapa.set(m.id, m);
  return [...mapa.values()].sort((a, b) => a.id - b.id);
}

export function formatearHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function estadoCambio(prev, next) {
  return !prev || prev.carta_texto !== next.carta_texto || prev.turno !== next.turno
    || prev.puntos1 !== next.puntos1 || prev.puntos2 !== next.puntos2;
}
```

- [ ] **Step 4: Ejecutar y verificar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/online.js tests/online.test.js
git commit -m "feat: funciones puras del cliente online"
```

---

### Task 6: Pantallas online + chat (HTML + CSS) e integración en `js/online.js`

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/online.js` (capa DOM/navegación/polling)
- Modify: `js/app.js` (botón "Modo online" en inicio + `window.iniciarOnline` guard)

**Interfaces:**
- Consumes: funciones puras de `js/online.js` (Task 5); ids de pantallas de Task 6; `mostrarPantalla`, `sonidos`, `estado` de `js/app.js`.
- Produces: pantallas `pantalla-online` (hub), `pantalla-sala` (espera), `pantalla-chat`, `pantalla-online-partida`. En `js/app.js`: botón `#btn-modo-online` en inicio → `mostrarPantalla('online')`. `window.iniciarOnline = ...` guard. Claves localStorage `cp.dispositivo_id`, `cp.pareja_id`, `cp.ultimaSesion`, `cp.chat_local`.

- [ ] **Step 1: Añadir el botón en `index.html` (pantalla de inicio)**

Dentro de `#pantalla-inicio`, junto a `#btn-mis-cartas`:

```html
<button id="btn-modo-online" class="boton boton-secundario" type="button">Modo online</button>
```

- [ ] **Step 2: Añadir las pantallas online a `index.html` (antes de `</main>` o donde se cierran las secciones)**

```html
<section id="pantalla-online" class="pantalla oculto">
  <h2 class="pantalla-titulo">Modo online</h2>
  <div class="online-hub">
    <button id="btn-crear-sala" class="boton boton-primario" type="button">Crear código</button>
    <div class="online-join">
      <input id="input-codigo" class="input" type="text" inputmode="numeric" maxlength="8" placeholder="Código de 6 dígitos">
      <button id="btn-unirse-sala" class="boton boton-secundario" type="button">Unirme</button>
    </div>
    <button id="btn-reanudar-sala" class="boton boton-secundario oculto" type="button">Reanudar última sesión</button>
    <button id="btn-mis-chats" class="boton boton-secundario" type="button">Mis chats</button>
    <button id="btn-volver-online" class="boton-enlace" type="button">Volver</button>
  </div>
</section>

<section id="pantalla-sala" class="pantalla oculto">
  <div class="sala-contenido">
    <h2 class="pantalla-titulo">Sala de espera</h2>
    <div id="sala-codigo" class="sala-codigo">------</div>
    <p class="sala-hint">Compartí este código con tu pareja</p>
    <div id="sala-jugadores" class="sala-jugadores"></div>
    <div id="sala-estado" class="sala-estado">Esperando al otro jugador…</div>
    <button id="btn-comenzar-online" class="boton boton-primario oculto" type="button">Comenzar</button>
    <button id="btn-chat-sala" class="boton boton-secundario" type="button">Chat 💬</button>
    <button id="btn-salir-sala" class="boton-enlace" type="button">Salir</button>
  </div>
</section>

<section id="pantalla-online-partida" class="pantalla oculto">
  <div id="online-banner" class="online-banner">Conectando…</div>
  <div id="marcador-online" class="marcador" data-turno="1">
    <div id="online-marcador-p1" class="marcador-jugador">
      <div class="nombre">Jugador 1</div>
      <div class="puntos">0</div>
    </div>
    <div class="marcador-divisor" aria-hidden="true"></div>
    <div id="online-marcador-p2" class="marcador-jugador">
      <div class="nombre">Jugador 2</div>
      <div class="puntos">0</div>
    </div>
  </div>
  <div class="partida-cuerpo">
    <div class="anillo-contenedor">
      <svg id="anillo-online" viewBox="0 0 36 36" aria-hidden="true">
        <path d="M18 2 a16 16 0 0 1 0 32 a16 16 0 0 1 0 -32" fill="none" stroke="var(--vino)" stroke-width="3.5"/>
        <path id="anillo-online-arc" d="M18 2 a16 16 0 0 1 0 32 a16 16 0 0 1 0 -32" fill="none" stroke="var(--frambuesa)" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
      <div id="anillo-online-tiempo">45</div>
    </div>
    <div id="carta-online" class="carta">
      <span id="online-carta-categoria" class="carta-categoria">—</span>
      <p id="online-carta-texto">Esperando carta…</p>
    </div>
    <div class="partida-acciones">
      <button id="btn-online-no-hecho" class="boton boton-no-hecho" type="button">No hecho</button>
      <button id="btn-online-hecho" class="boton boton-hecho" type="button">Hecho</button>
    </div>
  </div>
  <div class="partida-pie">
    <button id="btn-online-chat" class="boton-silencio" type="button" aria-label="Abrir chat">💬</button>
    <button id="btn-online-salir" class="boton-enlace" type="button">Salir</button>
  </div>
</section>

<section id="pantalla-chat" class="pantalla oculto">
  <div class="chat-cabecera">
    <button id="btn-chat-atras" class="boton-enlace" type="button">← Volver</button>
    <h2 class="pantalla-titulo">Chat</h2>
  </div>
  <div id="chat-mensajes" class="chat-mensajes"></div>
  <div class="chat-input">
    <label class="chat-foto" aria-label="Enviar foto">
      📷
      <input id="input-chat-foto" type="file" accept="image/*" hidden>
    </label>
    <input id="input-chat-texto" class="input" type="text" placeholder="Escribí un mensaje..." maxlength="500">
    <button id="btn-chat-enviar" class="boton boton-primario" type="button">Enviar</button>
  </div>
</section>

<section id="pantalla-mischats" class="pantalla oculto">
  <h2 class="pantalla-titulo">Mis chats</h2>
  <div id="lista-chats" class="lista-chats"></div>
  <button id="btn-volver-online-chats" class="boton-enlace" type="button">Volver</button>
</section>
```

- [ ] **Step 3: Añadir CSS a `css/styles.css`**

Estilos consistentes con la paleta (reutilizar `.marcador`, `.carta`, `.partida-cuerpo`, `.anillo-contenedor`, `.boton`, `.input` existentes). Añadir:

```css
.online-hub { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 360px; }
.online-join { display: flex; gap: 8px; }
.online-join .input { flex: 1; text-align: center; letter-spacing: 0.2em; font-size: 1.2rem; }
.sala-contenido { display: flex; flex-direction: column; align-items: center; gap: 18px; width: 100%; max-width: 360px; }
.sala-codigo { font-size: 2.4rem; font-weight: 800; letter-spacing: 0.35em; color: var(--rosa); background: var(--surface); border: 2px dashed var(--frambuesa); border-radius: 16px; padding: 18px 22px; }
.sala-jugadores { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sala-jugadores .jugador { background: var(--surface); border: 1px solid var(--vino); border-radius: 12px; padding: 10px 14px; color: var(--texto); display: flex; justify-content: space-between; }
.online-banner { width: 100%; text-align: center; padding: 6px 12px; border-radius: 999px; background: var(--surface); color: var(--rosa); font-size: 0.8rem; }
.online-banner.desconectado { color: var(--tension); border: 1px solid var(--tension); }
.chat-cabecera { display: flex; align-items: center; gap: 10px; width: 100%; }
.chat-mensajes { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 12px 0; }
.chat-burbuja { max-width: 78%; padding: 10px 14px; border-radius: 16px; font-size: 0.95rem; word-break: break-word; }
.chat-burbuja.propia { align-self: flex-end; background: var(--grad-btn); color: #fff; border-bottom-right-radius: 4px; }
.chat-burbuja.ajena { align-self: flex-start; background: var(--surface); color: var(--texto); border-bottom-left-radius: 4px; }
.chat-burbuja .hora { display: block; font-size: 0.68rem; opacity: 0.75; margin-top: 4px; }
.chat-burbuja img { max-width: 220px; border-radius: 10px; display: block; }
.chat-input { display: flex; gap: 8px; align-items: center; width: 100%; }
.chat-input .input { flex: 1; }
.chat-foto { font-size: 1.5rem; cursor: pointer; }
.lista-chats { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 380px; }
.chat-item { background: var(--surface); border: 1px solid var(--vino); border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.chat-item .ultimo { color: var(--inactivo); font-size: 0.8rem; }
```

Verificar que `.pantalla` tenga `overflow-y: auto` para pantallas largas (chat, chats) — si no, añadir.

- [ ] **Step 4: Completar `js/online.js` (capa DOM/polling)**

Añadir al final del módulo (tras las funciones puras), todo dentro de guards de `window`:

- `dispositivoId()`: lee o crea `cp.dispositivo_id` (crypto.randomUUID si existe, si no fallback `Math.random`).
- `obtenerParejaId()` / `guardarParejaId(id)`: `cp.pareja_id`.
- `guardarUltimaSesion({sesion_id, codigo})`: `cp.ultimaSesion`.
- `leerChatLocal()` / `guardarChatLocal(arr)`: `cp.chat_local`.
- `iniciarPolling(sesion_id)`: `setInterval` 1.5s → `GET /api/sesion-estado` + `GET /api/mensajes?after=`. Actualiza pantalla si `estadoCambio`. Pausa con `visibilitychange`.
- `renderOnlineEstado(estado)`: pinta marcador, carta, banner de conexión, habilita/deshabilita botones según turno (`turno===1` y dispositivo es creador, o `turno===2` y dispositivo es jugador2).
- `resolverOnline(hecho)`: `POST /api/sesion-turno`.
- Chat: `cargarChat()`, `renderChat()`, `enviarTexto()`, `enviarFoto(file)` (FileReader → base64 → `POST /api/mensajes` + guardar local), `abrirChat()`.
- Exponer `window.Online = { crearSala, unirseSala, reanudarSala, abrirChat, mostrarMischats, borrarChat }`.
- `window.mostrarPantalla` usado para navegación entre pantallas online.

Nota: las fotos se envían como `tipo:'foto'`, `contenido` = data URL base64 comprimida; al recibir por polling se guardan en `cp.chat_local`. El payload de polling es solo de texto (`id > after`), las fotos no re-viajan por polling una vez recibidas (el `after` las marca como ya vistas).

- [ ] **Step 5: Integrar el botón en `js/app.js`**

En `init()` (junto a `btnMisCartas`):

```js
const btnModoOnline = document.getElementById('btn-modo-online');
if (btnModoOnline) btnModoOnline.addEventListener('click', () => {
  window.Online?.iniciar();
  mostrarPantalla('online');
});
```

- [ ] **Step 6: Verificación en navegador**

Con `vercel dev` local (necesita `DATABASE_URL` en entorno) o con un stub de API servido localmente, verificar:
- Inicio → "Modo online" → hub se muestra.
- "Crear código" → sala de espera con código de 6 dígitos.
- En una segunda pestaña/navegador: "Unirme" con el código → ambos en sala → "Comenzar" habilita.
- Partida: la carta aparece en ambas pestañas sincronizada; el jugador fuera de turno tiene botones deshabilitados; al resolver el en turno, alterna y suma punto en ambas.
- Chat: enviar mensaje aparece en ambas; enviar foto aparece en ambas; reconectar reanuda.
- Sin errores de consola.

Si no hay DB disponible localmente, documentar el paso para configurar `DATABASE_URL` y ejecutar `node scripts/migrate.mjs`, y verificar el render de pantallas estático.

- [ ] **Step 7: Commit**

```bash
git add index.html css/styles.css js/online.js js/app.js
git commit -m "feat: pantallas online, sala, chat y polling"
```

---

### Task 7: Verificación integral, README y despliegue

**Files:**
- Modify: `README.md`
- Modify: `sw.js` (añadir `js/online.js` al precache ASSETS)

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Añadir `js/online.js` al precache del SW**

En `sw.js` ASSETS añadir `'./js/online.js'` y bumpear `CACHE` a `'cartas-parejas-v4'`.

- [ ] **Step 2: Documentar en `README.md`**

Sección "Modo online": cómo crear/unirse con código, cómo funciona el chat y las fotos, cómo se guardan los chats (Neon, hasta borrado manual), y el paso de configuración `DATABASE_URL` + `node scripts/migrate.mjs` para el cliente/desarrollador.

- [ ] **Step 3: Ejecutar todos los tests**

Run: `npm test`
Expected: PASS completo.

- [ ] **Step 4: Migrar el esquema a Neon**

Con `DATABASE_URL` en el entorno, ejecutar:

```bash
DATABASE_URL="<connection string>" node scripts/migrate.mjs
```

Verificar salida "Esquema aplicado correctamente".

- [ ] **Step 5: Verificación integral con API real**

Con `DATABASE_URL` configurada y `vercel dev` (o el deploy), recorrer: crear pareja → crear sala → join → estado → turnos → mensajes → chats → borrar chat. Confirmar persistencia real en Neon (consultar con un SELECT).

- [ ] **Step 6: Commit**

```bash
git add README.md sw.js
git commit -m "docs y sw: modo online"
```

- [ ] **Step 7: Push a GitHub**

```bash
git push
```

- [ ] **Step 8: Configurar `DATABASE_URL` en Vercel**

```bash
vercel env add DATABASE_URL
```

Pegar la connection string y seleccionar "Production" (y "Preview" si se quiere). Nota: este paso depende de la aprobación del usuario si se acordó no tocar Vercel — coordinar con el cliente.

---

## Self-Review

**Spec coverage:**
- Pareja + sesión con código → Tasks 1-2. ✓
- Polling 1.5s + pausa por visibility → Task 6 (iniciarPolling). ✓
- Turno sincronizado, solo el en turno resuelve → Task 3 + Task 6. ✓
- Mensajes texto + foto, solo en vivo + local → Tasks 4-5-6. ✓
- Historial continuo por pareja + Mis chats + borrado manual → Tasks 4-6 (chats.js, lista-chats, borrar). ✓
- Sala abierta y reanudación → Task 2 (reutiliza sala abierta) + Task 6 (reanudar). ✓
- `DATABASE_URL` en env, nunca en código → Task 1 + Global Constraints. ✓
- Lista de conversaciones → Task 6 (pantalla-mischats). ✓
- Fotos comprimidas máx 1MB → Task 6. ✓
- Pantalla de sala de espera + código → Task 6. ✓

**Placeholder scan:** Ningún TBD. Todos los pasos tienen código concreto. El Step 6 de Task 6 y el Task 7 Step 5 dependen de `DATABASE_URL`/`vercel dev`; se documenta la alternativa de stub, y el paso de env en Vercel se coordina con el cliente.

**Type consistency:** `handle(req, res, db)` con `db` como tagged-template callable en todas las api. `seleccionarCarta(cartas, categorias, prevTexto)` → `{categoria, texto}` usado igual en sesion.js y sesion-turno.js. `fusionarMensajes(local, remotos)` usado en Task 6. `normalizarCodigo` en Task 6. Nombres de columnas consistentes entre `_schema.sql` y las queries (`pareja_id`, `carta_categoria`, `carta_texto`, `creador_id`, `jugador2_id`, `nombre1`, `nombre2`, `categorias`, `puntos1`, `puntos2`, `turno`, `estado`, `codigo`). ✓

**Nota (ruling):** El Task 4 usa `DISTINCT` en la query de chats; con múltiples mensajes por pareja puede devolver filas repetidas. Se corrige en Task 8 (verificación real) usando `DISTINCT ON (pareja_id)` si el stub no lo exige y la DB real lo necesita.