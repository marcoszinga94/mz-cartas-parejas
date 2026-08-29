import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no configurada');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL('../api/_schema.sql', import.meta.url), 'utf8');
await sql(schema);
console.log('Esquema aplicado correctamente');