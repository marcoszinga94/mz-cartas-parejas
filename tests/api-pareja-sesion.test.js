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
    if (q.includes('INSERT INTO sesiones')) return [{ id: 1 }];
    if (q.includes('UPDATE sesiones')) return [];
    throw new Error(`Query no contemplada en el fake: ${q.slice(0, 60)}`);
  };
}

const db = fakeDb({
  'INSERT INTO parejas (creada_at) VALUES (now()) RETURNING id': [{ id: 1 }],
  'SELECT id, codigo FROM sesiones WHERE pareja_id = ? AND estado != \'jugando\' AND creador_id = ? ORDER BY id DESC LIMIT 1': [],
  'SELECT id, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE codigo = ?': [],
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