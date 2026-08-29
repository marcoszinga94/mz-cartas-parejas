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

function fakeDb(updateResult = [{ id: 1 }]) {
  return async (strings) => {
    const q = strings.join('?');
    if (q.includes('FROM sesiones WHERE id')) return [base];
    if (q.includes('UPDATE sesiones')) return updateResult;
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

test('doble tap: segunda llamada con turno vencido devuelve el estado actual', async () => {
  const avanzada = { ...base, turno: 2, puntos1: 1, carta_texto: 'carta nueva' };
  const respuestas = [base, avanzada];
  let sel = 0;
  const dbStale = async (strings) => {
    const q = strings.join('?');
    if (q.includes('FROM sesiones WHERE id')) return [respuestas[Math.min(sel++, respuestas.length - 1)]];
    if (q.includes('UPDATE sesiones')) return [];
    throw new Error(`Query no contemplada: ${q.slice(0, 60)}`);
  };
  const res = fakeRes();
  await handleTurno({ body: { sesion_id: 1, dispositivo_id: 'd1', hecho: true } }, res, dbStale);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.turno, 2);
  assert.equal(res.body.puntos1, 1);
  assert.equal(res.body.carta_texto, 'carta nueva');
});