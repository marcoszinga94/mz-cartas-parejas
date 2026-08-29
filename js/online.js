export function normalizarCodigo(codigo) {
  const limpio = String(codigo || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(limpio) ? limpio : null;
}

export function fusionarMensajes(local, remotos) {
  const mapa = new Map();
  for (const m of [...local, ...remotos]) mapa.set(m.id, m);
  return [...mapa.values()].sort((a, b) => a.id - b.id);
}

export function formatearHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function estadoCambio(prev, next) {
  return !prev || prev.carta_texto !== next.carta_texto || prev.turno !== next.turno
    || prev.puntos1 !== next.puntos1 || prev.puntos2 !== next.puntos2;
}