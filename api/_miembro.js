export async function esMiembro(db, pareja_id, dispositivo_id) {
  if (!pareja_id || !dispositivo_id) return false;
  const rows = await db`SELECT 1 FROM sesiones WHERE pareja_id = ${pareja_id} AND (creador_id = ${dispositivo_id} OR jugador2_id = ${dispositivo_id}) LIMIT 1`;
  return rows.length > 0;
}