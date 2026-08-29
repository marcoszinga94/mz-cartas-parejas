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
  let anterior = r1.texto;
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