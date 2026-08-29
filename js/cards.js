export function mergeCards(base, usuario) {
  const maxId = base.reduce((m, c) => Math.max(m, c.id), 0);
  const anexadas = (usuario || []).map((c, i) => ({ ...c, id: maxId + i + 1 }));
  return [...base, ...anexadas];
}

export function mezclarDeck(merged, categorias) {
  const filtradas = merged.filter(c => categorias.includes(c.categoria));
  const barajadas = [...filtradas];
  for (let i = barajadas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [barajadas[i], barajadas[j]] = [barajadas[j], barajadas[i]];
  }
  return barajadas;
}

export function robarCarta(deck, prevId) {
  if (deck.length === 0) {
    throw new Error('Mazo vacío');
  }
  let mazo = [...deck];
  if (mazo[0].id === prevId && mazo.length > 1) {
    const categorias = [...new Set(mazo.map(c => c.categoria))];
    mazo = mezclarDeck(mazo, categorias);
    if (mazo[0].id === prevId) {
      mazo = [...mazo.slice(1), mazo[0]];
    }
  }
  const [carta, ...resto] = mazo;
  return { carta, deck: [...resto, carta] };
}