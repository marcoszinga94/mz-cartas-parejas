import { getSql } from './_db.js';

export async function handle(req, res, db = getSql()) {
  const { dispositivo_id } = req.body || {};
  if (!dispositivo_id) return res.status(400).json({ error: 'Falta dispositivo_id' });
  try {
    const rows = await db`INSERT INTO parejas (creada_at) VALUES (now()) RETURNING id`;
    return res.status(200).json({ pareja_id: rows[0].id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default (req, res, db) => handle(req, res, db);