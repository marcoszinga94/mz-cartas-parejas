import { readFileSync } from 'node:fs';

let cache = null;

export function cargarCartas() {
  if (!cache) {
    const raw = readFileSync(new URL('../data/cartas.json', import.meta.url), 'utf8');
    cache = JSON.parse(raw);
  }
  return cache;
}

export function seleccionarCarta(cartas, categorias, prevTexto) {
  const pool = cartas.filter(c => categorias.includes(c.categoria) && c.texto !== prevTexto);
  const eligibles = pool.length > 0 ? pool : cartas.filter(c => categorias.includes(c.categoria));
  if (eligibles.length === 0) return { categoria: '', texto: '' };
  const c = eligibles[Math.floor(Math.random() * eligibles.length)];
  return { categoria: c.categoria, texto: c.texto };
}