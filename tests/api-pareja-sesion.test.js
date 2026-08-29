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

function fakeDb({ selectCodigo = [], updateResult = [{ id: 1 }] } = {}) {
  return async (strings) => {
    const q = strings.join('?');
    if (q.includes('FROM sesiones WHERE codigo')) return selectCodigo;
    if (q.includes('SELECT id, codigo FROM sesiones')) return [];
    if (q.includes('INSERT INTO parejas')) return [{ id: 1 }];
    if (q.includes('INSERT INTO sesiones')) return [{ id: 1 }];
    if (q.includes('UPDATE sesiones')) return updateResult;
    throw new Error(`Query no contemplada en el fake: ${q.slice(0, 60)}`);
  };
}

const db = fakeDb({
  selectCodigo: [{
    id: 1, pareja_id: 1, estado: 'espera', turno: 1, puntos1: 0, puntos2: 0,
    carta_categoria: 'Hot', carta_texto: 'carta', nombre1: 'A', nombre2: 'B', categorias: '["Hot"]', jugador2_id: 'd2',
  }],
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
  await handleJoin({ body: { codigo: '000000', dispositivo_id: 'd2', nombre: 'B' } }, res, fakeDb());
  assert.equal(res.statusCode, 404);
});

test('sesion sin body valido da 400', async () => {
  const res = fakeRes();
  await handleSesion({ body: { pareja_id: 1 } }, res, db);
  assert.equal(res.statusCode, 400);
});

test('sesion con pareja inexistente (FK) da 404', async () => {
  const res = fakeRes();
  const dbFk = async (strings) => {
    const q = strings.join('?');
    if (q.includes('SELECT id, codigo FROM sesiones')) return [];
    const e = new Error('violates foreign key constraint "sesiones_pareja_id_fkey"');
    e.code = '23503';
    throw e;
  };
  await handleSesion({ body: { pareja_id: 999, dispositivo_id: 'd1', nombre: 'A', categorias: ['Hot'] } }, res, dbFk);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'La pareja ya no existe');
});

test('mismo dispositivo se re-une con otro nombre (200)', async () => {
  const res = fakeRes();
  await handleJoin({ body: { codigo: '123456', dispositivo_id: 'd2', nombre: 'B2' } }, res, db);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.jugadores[2], 'B2');
});

test('otro dispositivo como segundo jugador da 409', async () => {
  const res = fakeRes();
  await handleJoin({ body: { codigo: '123456', dispositivo_id: 'd3', nombre: 'C' } }, res, db);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'La sala ya tiene un segundo jugador');
});

test('join atomico: si el slot lo tomo otro dispositivo en paralelo, 409', async () => {
  const res = fakeRes();
  const dbRaza = fakeDb({
    selectCodigo: [{
      id: 1, pareja_id: 1, estado: 'espera', turno: 1, puntos1: 0, puntos2: 0,
      carta_categoria: 'Hot', carta_texto: 'carta', nombre1: 'A', nombre2: null, categorias: '["Hot"]', jugador2_id: null,
    }],
    updateResult: [],
  });
  await handleJoin({ body: { codigo: '123456', dispositivo_id: 'd3', nombre: 'C' } }, res, dbRaza);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'La sala ya tiene un segundo jugador');
});