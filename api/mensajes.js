import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  if (req.method === 'POST') {
    const { pareja_id, autor_id, tipo, contenido } = req.body || {};
    if (!pareja_id || !autor_id || !contenido) return res.status(400).json({ error: 'Faltan datos' });
    if (tipo !== 'texto' && tipo !== 'foto') return res.status(400).json({ error: 'Tipo inválido' });
    try {
      const rows = await db`INSERT INTO mensajes (pareja_id, autor_id, tipo, contenido) VALUES (${pareja_id}, ${autor_id}, ${tipo}, ${contenido}) RETURNING id`;
      return res.status(200).json({ id: rows[0].id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'GET') {
    const pareja_id = Number(req.query?.pareja_id);
    const after = Number(req.query?.after || 0);
    if (!pareja_id) return res.status(400).json({ error: 'Falta pareja_id' });
    try {
      const mensajes = await db`SELECT id, autor_id, tipo, contenido, creada_at FROM mensajes WHERE pareja_id = ${pareja_id} AND id > ${after} ORDER BY id ASC`;
      return res.status(200).json({ mensajes });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

export default (req, res, db) => handle(req, res, db);