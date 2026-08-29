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
const foto = { id: 8, pareja_id: 1, autor_id: 'd1', tipo: 'foto', contenido: 'data:image/jpeg;base64,AAAA', creada_at: '2026-01-01T00:00:00Z' };

function fakeDb({ member = true, mensajes = null, actualizaciones = [] } = {}) {
  return async (strings) => {
    const q = strings.join('?');
    if (q.includes('SELECT 1 FROM sesiones WHERE pareja_id')) return member ? [{ 1: 1 }] : [];
    if (q.includes('INSERT INTO mensajes')) return [{ id: mensaje.id }];
    if (q.includes('FROM mensajes WHERE pareja_id')) return mensajes || [mensaje];
    if (q.includes('UPDATE mensajes SET contenido')) { actualizaciones.push(q); return []; }
    if (q.includes('LEFT JOIN mensajes m')) return [{ pareja_id: 1, ultimo_mensaje: 'hola', actualizado_at: '2026-01-01T00:00:00Z' }];
    if (q.includes('DELETE FROM parejas')) return [];
    throw new Error(`Query no contemplada: ${q.slice(0, 60)}`);
  };
}

test('enviar mensaje de texto', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'POST', body: { pareja_id: 1, autor_id: 'd1', tipo: 'texto', contenido: 'hola' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.id > 0);
});

test('enviar foto valida (data:image)', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'POST', body: { pareja_id: 1, autor_id: 'd1', tipo: 'foto', contenido: foto.contenido } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.id > 0);
});

test('enviar foto que no es data:image da 400', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'POST', body: { pareja_id: 1, autor_id: 'd1', tipo: 'foto', contenido: 'https://x.com/a.jpg' } }, res, fakeDb());
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Foto inválida');
});

test('enviar foto de mas de 1MB base64 da 400', async () => {
  const res = fakeRes();
  const enorme = 'data:image/png;base64,' + 'a'.repeat(1500001);
  await handleMensajes({ method: 'POST', body: { pareja_id: 1, autor_id: 'd1', tipo: 'foto', contenido: enorme } }, res, fakeDb());
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Foto inválida');
});

test('listar mensajes nuevos desde after', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'GET', query: { pareja_id: '1', after: '5', dispositivo_id: 'd1' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mensajes[0].contenido, 'hola');
});

test('listar mensajes sin dispositivo_id da 400', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'GET', query: { pareja_id: '1', after: '5' } }, res, fakeDb());
  assert.equal(res.statusCode, 400);
});

test('listar mensajes de pareja ajena da 403', async () => {
  const res = fakeRes();
  await handleMensajes({ method: 'GET', query: { pareja_id: '1', after: '5', dispositivo_id: 'foraneo' } }, res, fakeDb({ member: false }));
  assert.equal(res.statusCode, 403);
});

test('al entregar una foto al receptor se vacia el contenido en el servidor', async () => {
  const actualizaciones = [];
  const res = fakeRes();
  await handleMensajes({ method: 'GET', query: { pareja_id: '1', after: '0', dispositivo_id: 'd2' } }, res, fakeDb({ mensajes: [foto], actualizaciones }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mensajes[0].contenido, foto.contenido);
  assert.equal(actualizaciones.length, 1);
  assert.match(actualizaciones[0], /UPDATE mensajes SET contenido = '' WHERE id = \?/);
});

test('el autor de su propia foto no dispara la purga', async () => {
  const actualizaciones = [];
  const res = fakeRes();
  await handleMensajes({ method: 'GET', query: { pareja_id: '1', after: '0', dispositivo_id: 'd1' } }, res, fakeDb({ mensajes: [foto], actualizaciones }));
  assert.equal(res.statusCode, 200);
  assert.equal(actualizaciones.length, 0);
});

test('listar chats del dispositivo', async () => {
  const res = fakeRes();
  await handleChats({ method: 'GET', query: { dispositivo_id: 'd1' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.chats[0].pareja_id, 1);
});

test('borrar chat siendo miembro', async () => {
  const res = fakeRes();
  await handleChats({ method: 'DELETE', query: { pareja_id: '1', dispositivo_id: 'd1' } }, res, fakeDb());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('borrar chat sin dispositivo_id da 400', async () => {
  const res = fakeRes();
  await handleChats({ method: 'DELETE', query: { pareja_id: '1' } }, res, fakeDb());
  assert.equal(res.statusCode, 400);
});

test('borrar chat de pareja ajena da 403', async () => {
  const res = fakeRes();
  await handleChats({ method: 'DELETE', query: { pareja_id: '1', dispositivo_id: 'foraneo' } }, res, fakeDb({ member: false }));
  assert.equal(res.statusCode, 403);
});