import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, guardarEstado, cargarEstado } from '../js/app.js';

test('estadoInicial tiene la forma correcta', () => {
  const s = estadoInicial();
  assert.equal(s.p1, 'Jugador 1');
  assert.equal(s.p2, 'Jugador 2');
  assert.equal(s.puntos1, 0);
  assert.equal(s.puntos2, 0);
  assert.equal(s.turno, 1);
  assert.equal(s.enPartida, false);
});

test('guardar/cargar estado sobrevive', () => {
  guardarEstado({ p1: 'A', p2: 'B', puntos1: 3, puntos2: 1, turno: 2, config: { tiempo: 45 }, enPartida: true });
  const s = cargarEstado();
  assert.equal(s.p1, 'A');
  assert.equal(s.puntos1, 3);
  assert.equal(s.turno, 2);
  assert.equal(s.enPartida, true);
});
