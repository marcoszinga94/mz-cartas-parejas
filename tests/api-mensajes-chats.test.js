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
    if (q.includes('INSERT INTO mensajes')) return [{ id: mensaje.id }];
    if (q.includes('FROM mensajes WHERE pareja_id')) return [mensaje];
    if (q.includes('LEFT JOIN mensajes m')) return [{ pareja_id: 1, ultimo_mensaje: 'hola', actualizado_at: '2026-01-01T00:00:00Z' }];
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