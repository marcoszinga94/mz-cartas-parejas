import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCards, mezclarDeck, robarCarta } from '../js/cards.js';

const base = { categorias: ['Preguntas', 'Retos'], cartas: [
  { id: 1, categoria: 'Preguntas', texto: 'P1' },
  { id: 2, categoria: 'Retos', texto: 'R1' },
  { id: 3, categoria: 'Preguntas', texto: 'P2' },
] };

test('mergeCards re-numera y anexa las del usuario', () => {
  const usuario = { categorias: ['Loco'], cartas: [
    { id: 1, categoria: 'Loco', texto: 'L1' },
  ]};
  const res = mergeCards(base.cartas, usuario.cartas);
  assert.equal(res.length, 4);
  assert.equal(res[3].texto, 'L1');
  assert.equal(res[3].id, 4);
});

test('mezclarDeck filtra por categorias y baraja', () => {
  const res = mezclarDeck(mergeCards(base.cartas, []), ['Preguntas']);
  assert.equal(res.length, 2);
  assert.ok(res.every(c => c.categoria === 'Preguntas'));
});

test('robarCarta agota mazo, re-baraja sin repetir la anterior', () => {
  const deck = mezclarDeck(mergeCards(base.cartas, []), ['Preguntas', 'Retos']);
  const ids = new Set();
  let prevId = null;
  let restante = deck;
  for (let i = 0; i < 30; i++) {
    const { carta, deck: d } = robarCarta(restante, prevId);
    assert.notEqual(carta.id, prevId);
    ids.add(carta.id);
    prevId = carta.id;
    restante = d;
  }
  assert.ok(ids.has(1) && ids.has(2) && ids.has(3));
});

test('robarCarta al agotar el mazo conserva todas las cartas y no repite la anterior', () => {
  const deck = mezclarDeck(mergeCards(base.cartas, []), ['Preguntas', 'Retos']);
  let prevId = null;
  let restante = deck;
  const vistas = new Set();
  while (vistas.size < deck.length) {
    const { carta, deck: d } = robarCarta(restante, prevId);
    assert.notEqual(carta.id, prevId);
    vistas.add(carta.id);
    prevId = carta.id;
    restante = d;
  }
  assert.deepEqual(restante.map(c => c.id).sort((a, b) => a - b), [1, 2, 3]);
  assert.deepEqual([...new Set(restante.map(c => c.categoria))].sort(), ['Preguntas', 'Retos']);
  assert.notEqual(restante[0].id, prevId);
});