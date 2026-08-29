export function formatTiempo(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  if (s < 60) return String(s);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fraccionAnillo(total, restante) {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, restante / total));
}

export function esTension(restante, umbral = 10) {
  return restante <= umbral;
}