import { getSql } from './_db.js';
import { cargarCartas, seleccionarCarta } from './_cartas.js';

function estadoDesdeRow(s) {
  return {
    estado: s.estado, turno: s.turno, puntos1: s.puntos1, puntos2: s.puntos2,
    carta_categoria: s.carta_categoria, carta_texto: s.carta_texto,
    jugadores: { 1: s.nombre1, 2: s.nombre2 }, categorias: JSON.parse(s.categorias || '[]'),
  };
}

export async function handle(req, res, db = getSql()) {
  const { sesion_id, dispositivo_id, hecho } = req.body || {};
  if (!sesion_id || !dispositivo_id || typeof hecho !== 'boolean') return res.status(400).json({ error: 'Faltan datos' });
  try {
    const rows = await db`SELECT * FROM sesiones WHERE id = ${sesion_id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    const s = rows[0];
    const jugadorEnTurno = s.turno === 1 ? s.creador_id : s.jugador2_id;
    if (dispositivo_id !== jugadorEnTurno) return res.status(403).json({ error: 'No es tu turno' });
    const categorias = JSON.parse(s.categorias || '[]');
    let puntos1 = s.puntos1;
    let puntos2 = s.puntos2;
    if (hecho && s.turno === 1) puntos1 += 1;
    if (hecho && s.turno === 2) puntos2 += 1;
    const nueva = seleccionarCarta(cargarCartas().cartas, categorias, s.carta_texto);
    const turno = s.turno === 1 ? 2 : 1;
    const actualizado = await db`UPDATE sesiones SET puntos1 = ${puntos1}, puntos2 = ${puntos2}, turno = ${turno}, carta_categoria = ${nueva.categoria}, carta_texto = ${nueva.texto} WHERE id = ${sesion_id} AND turno = ${s.turno} RETURNING id`;
    if (actualizado.length === 0) {
      const actuales = await db`SELECT * FROM sesiones WHERE id = ${sesion_id}`;
      if (actuales.length === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
      return res.status(200).json(estadoDesdeRow(actuales[0]));
    }
    return res.status(200).json({
      estado: s.estado, turno, puntos1, puntos2, carta_categoria: nueva.categoria, carta_texto: nueva.texto,
      jugadores: { 1: s.nombre1, 2: s.nombre2 }, categorias,
    });
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

export default (req, res, db) => handle(req, res, db);