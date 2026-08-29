import { getSql } from './_db.js';
import { esMiembro } from './_miembro.js';

export async function handle(req, res, db = getSql()) {
  if (req.method === 'GET') {
    const { dispositivo_id } = req.query || {};
    if (!dispositivo_id) return res.status(400).json({ error: 'Falta dispositivo_id' });
    try {
      const chats = await db`SELECT DISTINCT ON (s.pareja_id) s.pareja_id, m.contenido AS ultimo_mensaje, m.creada_at AS actualizado_at
        FROM sesiones s
        LEFT JOIN mensajes m ON m.pareja_id = s.pareja_id
        WHERE s.creador_id = ${dispositivo_id} OR s.jugador2_id = ${dispositivo_id}
        ORDER BY s.pareja_id, m.creada_at DESC`;
      return res.status(200).json({ chats });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Error interno' });
    }
  }
  if (req.method === 'DELETE') {
    const pareja_id = Number(req.query?.pareja_id);
    const dispositivo_id = req.query?.dispositivo_id;
    if (!pareja_id) return res.status(400).json({ error: 'Falta pareja_id' });
    if (!dispositivo_id) return res.status(400).json({ error: 'Falta dispositivo_id' });
    try {
      if (!(await esMiembro(db, pareja_id, dispositivo_id))) return res.status(403).json({ error: 'No autorizado' });
      await db`DELETE FROM parejas WHERE id = ${pareja_id}`;
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Error interno' });
    }
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

export default (req, res, db) => handle(req, res, db);