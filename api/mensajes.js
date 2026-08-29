import { getSql } from './_db.js';
import { esMiembro } from './_miembro.js';

const FOTO_MAX = 1500000;

function contenidoFotoValido(contenido) {
  return typeof contenido === 'string' && contenido.startsWith('data:image/') && contenido.length <= FOTO_MAX;
}

export async function handle(req, res, db = getSql()) {
  if (req.method === 'POST') {
    const { pareja_id, autor_id, tipo, contenido } = req.body || {};
    if (!pareja_id || !autor_id || !contenido) return res.status(400).json({ error: 'Faltan datos' });
    if (tipo !== 'texto' && tipo !== 'foto') return res.status(400).json({ error: 'Tipo inválido' });
    if (tipo === 'foto' && !contenidoFotoValido(contenido)) return res.status(400).json({ error: 'Foto inválida' });
    try {
      const rows = await db`INSERT INTO mensajes (pareja_id, autor_id, tipo, contenido) VALUES (${pareja_id}, ${autor_id}, ${tipo}, ${contenido}) RETURNING id`;
      return res.status(200).json({ id: rows[0].id });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Error interno' });
    }
  }
  if (req.method === 'GET') {
    const pareja_id = Number(req.query?.pareja_id);
    const after = Number(req.query?.after || 0);
    const dispositivo_id = req.query?.dispositivo_id;
    if (!pareja_id) return res.status(400).json({ error: 'Falta pareja_id' });
    if (!dispositivo_id) return res.status(400).json({ error: 'Falta dispositivo_id' });
    try {
      if (!(await esMiembro(db, pareja_id, dispositivo_id))) return res.status(403).json({ error: 'No autorizado' });
      const mensajes = await db`SELECT id, autor_id, tipo, contenido, creada_at FROM mensajes WHERE pareja_id = ${pareja_id} AND id > ${after} ORDER BY id ASC`;
      const entregadas = mensajes.filter(m => m.tipo === 'foto' && m.contenido && m.autor_id !== dispositivo_id);
      for (const m of entregadas) {
        await db`UPDATE mensajes SET contenido = '' WHERE id = ${m.id}`;
      }
      return res.status(200).json({ mensajes });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Error interno' });
    }
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

export default (req, res, db) => handle(req, res, db);