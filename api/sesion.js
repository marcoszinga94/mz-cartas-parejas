import { getSql } from './_db.js';
import { generarCodigo } from './_codigo.js';
import { cargarCartas, seleccionarCarta } from './_cartas.js';

export async function handle(req, res, db = getSql()) {
  const { pareja_id, dispositivo_id, nombre, categorias } = req.body || {};
  if (!pareja_id || !dispositivo_id || !nombre) return res.status(400).json({ error: 'Faltan datos' });
  if (!Array.isArray(categorias) || categorias.length === 0) return res.status(400).json({ error: 'Selecciona al menos una categoría' });
  try {
    const abiertas = await db`SELECT id, codigo FROM sesiones WHERE pareja_id = ${pareja_id} AND estado != 'jugando' AND creador_id = ${dispositivo_id} ORDER BY id DESC LIMIT 1`;
    if (abiertas.length > 0) return res.status(200).json({ codigo: abiertas[0].codigo, sesion_id: abiertas[0].id });
    const codigo = generarCodigo();
    const cartas = cargarCartas();
    const primera = seleccionarCarta(cartas.cartas, categorias, '');
    const rows = await db`INSERT INTO sesiones (pareja_id, codigo, creador_id, nombre1, categorias, carta_categoria, carta_texto)
      VALUES (${pareja_id}, ${codigo}, ${dispositivo_id}, ${nombre}, ${JSON.stringify(categorias)}, ${primera.categoria}, ${primera.texto})
      RETURNING id`;
    return res.status(200).json({ codigo, sesion_id: rows[0].id });
  } catch (e) {
    console.error(e.message);
    if (e?.code === '23503') return res.status(404).json({ error: 'La pareja ya no existe' });
    return res.status(500).json({ error: 'Error interno' });
  }
}

export default (req, res, db) => handle(req, res, db);