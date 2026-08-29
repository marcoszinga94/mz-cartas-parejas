import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTiempo, fraccionAnillo, esTension } from '../js/timer.js';

test('formatTiempo formatea <60s y >=60s', () => {
  assert.equal(formatTiempo(45), '45');
  assert.equal(formatTiempo(9), '9');
  assert.equal(formatTiempo(65), '1:05');
  assert.equal(formatTiempo(120), '2:00');
});

test('fraccionAnillo clampa 0..1', () => {
  assert.equal(fraccionAnillo(60, 60), 1);
  assert.equal(fraccionAnillo(60, 30), 0.5);
  assert.equal(fraccionAnillo(60, 0), 0);
  assert.equal(fraccionAnillo(60, -5), 0);
  assert.equal(fraccionAnillo(60, 99), 1);
});

test('esTension activa en el umbral', () => {
  assert.equal(esTension(10), true);
  assert.equal(esTension(11), false);
  assert.equal(esTension(0), true);
});