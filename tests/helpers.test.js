import { test } from 'node:test';
import assert from 'node:assert/strict';

export function sumar(a, b) { return a + b; }

test('runner funciona', () => {
  assert.equal(sumar(2, 2), 4);
});