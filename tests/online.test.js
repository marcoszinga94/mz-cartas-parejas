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

test('fusionarMensajes conserva el contenido local de una foto purgada', () => {
  const local = [{ id: 5, tipo: 'foto', contenido: 'data:image/jpeg;base64,AAA' }];
  const remotos = [{ id: 5, tipo: 'foto', contenido: '' }];
  const res = fusionarMensajes(local, remotos);
  assert.equal(res[0].contenido, 'data:image/jpeg;base64,AAA');
  const remotoConPeso = fusionarMensajes([{ id: 5, tipo: 'foto', contenido: '' }], [{ id: 5, tipo: 'foto', contenido: 'data:image/jpeg;base64,BBB' }]);
  assert.equal(remotoConPeso[0].contenido, 'data:image/jpeg;base64,BBB');
});

test('formatearHora', () => {
  assert.match(formatearHora('2026-08-28T14:32:00Z'), /^\d{2}:\d{2}$/);
});

test('estadoCambio', () => {
  assert.equal(estadoCambio({ carta_texto: 'x', turno: 1, puntos1: 0 }, { carta_texto: 'y', turno: 1, puntos1: 0 }), true);
  assert.equal(estadoCambio({ carta_texto: 'x', turno: 1, puntos1: 0 }, { carta_texto: 'x', turno: 1, puntos1: 0 }), false);
  assert.equal(estadoCambio({ carta_texto: 'x', turno: 1, puntos1: 0 }, { carta_texto: 'x', turno: 2, puntos1: 0 }), true);
});