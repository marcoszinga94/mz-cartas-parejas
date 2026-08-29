import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../data/cartas.json', import.meta.url), 'utf8'));
const usuario = JSON.parse(readFileSync(new URL('../data/cartas-usuario.json', import.meta.url), 'utf8'));

test('cartas base: 7 categorias y >=50 cartas por categoria', () => {
  assert.deepEqual(base.categorias.sort(), ['Hot', 'Loco', 'Picante', 'Preguntas', 'Retos', 'Romantico', 'Sexting'].sort());
  for (const cat of base.categorias) {
    const n = base.cartas.filter(c => c.categoria === cat).length;
    assert.ok(n >= 50, `${cat} tiene ${n} cartas (min 50)`);
  }
});

test('todas las cartas tienen id unico, categoria valida y texto no vacio', () => {
  const ids = new Set(base.cartas.map(c => c.id));
  assert.equal(ids.size, base.cartas.length);
  for (const c of base.cartas) {
    assert.ok(base.categorias.includes(c.categoria));
    assert.ok(typeof c.texto === 'string' && c.texto.trim().length > 0);
  }
});

test('cartas-usuario tiene el mismo formato con cartas vacias', () => {
  assert.deepEqual(usuario.categorias, base.categorias);
  assert.ok(Array.isArray(usuario.cartas));
});