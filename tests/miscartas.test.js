import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarImportacion, renumerarCartas } from '../js/app.js';

test('validarImportacion acepta estructura valida', () => {
  const datos = { categorias: ['Preguntas'], cartas: [{ id: 1, categoria: 'Preguntas', texto: 'X' }] };
  assert.equal(validarImportacion(datos), true);
});

test('validarImportacion rechaza estructuras invalidas', () => {
  assert.equal(validarImportacion(null), false);
  assert.equal(validarImportacion({}), false);
  assert.equal(validarImportacion({ categorias: [] }), false);
  assert.equal(validarImportacion({ cartas: [] }), false);
  assert.equal(validarImportacion({ categorias: 'Preguntas', cartas: [] }), false);
  assert.equal(validarImportacion({ categorias: [], cartas: {} }), false);
});

test('renumerarCartas re-asigna ids secuenciales desde la base', () => {
  const res = renumerarCartas([
    { id: 99, categoria: 'Loco', texto: 'A' },
    { id: 5, categoria: 'Retos', texto: 'B' },
  ], 7);
  assert.deepEqual(res.map(c => c.id), [7, 8]);
  assert.equal(res[0].texto, 'A');
  assert.equal(res[1].categoria, 'Retos');
});