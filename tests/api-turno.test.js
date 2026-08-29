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