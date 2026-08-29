import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeUsarAudio } from '../js/sound.js';

test('puedeUsarAudio devuelve boolean', () => {
  assert.equal(typeof puedeUsarAudio(), 'boolean');
});