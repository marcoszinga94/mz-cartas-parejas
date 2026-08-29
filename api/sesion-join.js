import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  const { codigo, dispositivo_id, nombre } = req.body || {};
  if (!codigo || !dispositivo_id || !nombre) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const rows = await db`SELECT id, pareja_id, estado, turno, puntos1, puntos2, carta_categoria, carta_texto, nombre1, nombre2, categorias FROM sesiones WHERE codigo = ${codigo}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Código no encontrado' });
    const s = rows[0];
    if (s.nombre2 && s.nombre2 !== nombre) return res.status(409).json({ error: 'La sala ya tiene un segundo jugador' });
    await db`UPDATE sesiones SET jugador2_id = ${dispositivo_id}, nombre2 = ${nombre} WHERE id = ${s.id}`;
    const categorias = JSON.parse(s.categorias || '[]');
    return res.status(200).json({
      sesion_id: s.id, pareja_id: s.pareja_id, estado: s.estado, turno: s.turno,
      puntos1: s.puntos1, puntos2: s.puntos2, carta_categoria: s.carta_categoria, carta_texto: s.carta_texto,
      jugadores: { 1: s.nombre1, 2: nombre }, categorias,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res, db) => handle(req, res, db);