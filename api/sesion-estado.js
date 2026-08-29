import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  const sesion_id = Number(req.query?.sesion_id);
  if (!sesion_id) return res.status(400).json({ error: 'Falta sesion_id' });
  try {
    const rows = await db`SELECT id, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE id = ${sesion_id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    const s = rows[0];
    return res.status(200).json({
      estado: s.estado, turno: s.turno, puntos1: s.puntos1, puntos2: s.puntos2,
      carta_categoria: s.carta_categoria, carta_texto: s.carta_texto,
      jugadores: { 1: s.nombre1, 2: s.nombre2 }, categorias: JSON.parse(s.categorias || '[]'),
    });
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

export default (req, res, db) => handle(req, res, db);