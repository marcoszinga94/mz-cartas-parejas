import { neon } from '@neondatabase/serverless';

let sql = null;

export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no configurada');
    sql = neon(url);
  }
  return sql;
}

export function resetSql() {
  sql = null;
}